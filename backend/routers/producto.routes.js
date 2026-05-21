const express = require("express");
const multer = require("multer");
const productoController = require("../controllers/producto.controller");

const router = express.Router();

const uploadExportStock = multer({
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
      cb(new Error("Sube un archivo Excel (.xlsx o .xls)."));
    }
  }
});

router.get("/resumen-stock-vs-real", productoController.resumenStockVsReal);
router.get(
  "/discrepancias-stock-lista",
  productoController.listaDiscrepanciaStock
);
router.post("/buscar", productoController.buscarProducto);
router.post("/buscar-ocr", productoController.buscarPorOcr);
router.post("/stock-real", productoController.guardarStocks);
router.post(
  "/sincronizar-stock-export",
  uploadExportStock.single("archivo"),
  productoController.sincronizarStockExport
);

module.exports = router;
