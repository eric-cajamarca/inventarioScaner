const os = require("os");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routers/auth.routes");
const productoRoutes = require("./routers/producto.routes");
const reconciliacionRoutes = require("./routers/reconciliacion.routes");
const errorHandler = require("./midlewares/errorHandler");
const verificarToken = require("./midlewares/verificarToken");
const { generarTodasLasPlantillas } = require("./utils/plantillasInventario");

const app = express();
const PORT = Number(process.env.PORT) || 3005;
const HOST = process.env.HOST || "0.0.0.0";
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "Inventario Scanner backend activo"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/productos", verificarToken, productoRoutes);
app.use("/api/reconciliacion", verificarToken, reconciliacionRoutes);
app.use(express.static(FRONTEND_DIR));
app.use(errorHandler);

try {
  generarTodasLasPlantillas();
} catch (err) {
  console.error("No se pudieron generar plantillas de reconciliación:", err);
}

function direccionesLan() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const esV4 = net.family === "IPv4" || net.family === 4;
      if (esV4 && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const server = app.listen(PORT, HOST, () => {
  const lan = direccionesLan();
  const lineasLan =
    lan.length > 0
      ? lan.map((ip) => `  http://${ip}:${PORT}`).join("\n") + "\n"
      : "";
  process.stdout.write(
    `API + frontend (local): http://localhost:${PORT}\n` +
      (lineasLan ? `Misma red (LAN):\n${lineasLan}` : "")
  );
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Puerto ${PORT} ocupado. Cierra la otra ventana de node o el proceso que lo usa, o pon PORT=3006 en .env`
    );
  } else {
    console.error("Error al arrancar el servidor:", err);
  }
  process.exit(1);
});
