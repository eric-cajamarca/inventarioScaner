require("dotenv").config();

const os = require("os");
const express = require("express");
const cors = require("cors");
const productoRoutes = require("./routers/producto.routes");
const errorHandler = require("./midlewares/errorHandler");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "Inventario Scanner backend activo"
  });
});

app.use("/api/productos", productoRoutes);

app.use(errorHandler);

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
      ? lan.map((ip) => `  http://${ip}:${PORT}/api`).join("\n") + "\n"
      : "";
  process.stdout.write(
    `API backend (local): http://localhost:${PORT}/api\n` +
      (lineasLan ? `Misma red (LAN):\n${lineasLan}` : "") +
      `Sirve el frontend aparte (p. ej. puerto 4200).\n`
  );
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Puerto ${PORT} ocupado. Cierra la otra ventana de node o el proceso que lo usa, o pon PORT=3001 en .env`
    );
  } else {
    console.error("Error al arrancar el servidor:", err);
  }
  process.exit(1);
});
