const express = require("express");
const multer = require("multer");
const reconciliacionController = require("../controllers/reconciliacion.controller");
const verificarToken = require("../midlewares/verificarToken");

const router = express.Router();
router.use(verificarToken);

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const mime = file.mimetype || "";
    const okMime =
      mime ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel";
    const okExt = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (okMime || okExt) {
      cb(null, true);
    } else {
      cb(new Error("Sube archivos Excel (.xlsx o .xls)."));
    }
  }
});

const uploadReconciliacion = uploadExcel.fields([
  { name: "stockAnterior", maxCount: 1 },
  { name: "compras", maxCount: 1 },
  { name: "ventas", maxCount: 1 },
  { name: "stockActual", maxCount: 1 }
]);

router.get("/plantillas", reconciliacionController.listarPlantillas);
router.get(
  "/plantillas/:tipo",
  reconciliacionController.descargarPlantilla
);
router.post(
  "/ejecutar",
  uploadReconciliacion,
  reconciliacionController.ejecutarReconciliacion
);

module.exports = router;
