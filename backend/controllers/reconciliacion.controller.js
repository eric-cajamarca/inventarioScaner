const reconciliacionService = require("../services/reconciliacion.service");
const { obtenerRutaPlantilla, listarPlantillasDisponibles } = require("../utils/plantillasInventario");

async function ejecutarReconciliacion(req, res, next) {
  try {
    const stockAnterior = req.files?.stockAnterior?.[0]?.buffer;
    const compras = req.files?.compras?.[0]?.buffer;
    const ventas = req.files?.ventas?.[0]?.buffer;
    const stockActual = req.files?.stockActual?.[0]?.buffer;

    const resultado = await reconciliacionService.reconciliarMovimientos({
      stockAnterior,
      compras,
      ventas,
      stockActual
    });

    res.json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

async function descargarPlantilla(req, res, next) {
  try {
    const info = obtenerRutaPlantilla(req.params.tipo);
    if (!info) {
      throw new Error(
        'Plantilla no encontrada. Usa: compras, ventas o stock-actual.'
      );
    }
    res.download(info.ruta, info.def.nombreArchivo);
  } catch (error) {
    next(error);
  }
}

async function listarPlantillas(_req, res, next) {
  try {
    const plantillas = listarPlantillasDisponibles();
    res.json({ ok: true, plantillas });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  ejecutarReconciliacion,
  descargarPlantilla,
  listarPlantillas
};
