const productoService = require("../services/producto.service");

async function buscarProducto(req, res, next) {
  try {
    const { codigo } = req.body;
    const resultado = await productoService.buscarPorCodigo(codigo);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

async function buscarPorOcr(req, res, next) {
  try {
    const { texto } = req.body;
    const resultado = await productoService.buscarPorTextoOcr(texto);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

async function guardarStocks(req, res, next) {
  try {
    const { codigo } = req.body;
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "stock")) {
      payload.stock = req.body.stock;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "stockReal")) {
      payload.stockReal = req.body.stockReal;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "producto")) {
      payload.producto = req.body.producto;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "verificado")) {
      payload.verificado = req.body.verificado;
    }
    const resultado = await productoService.actualizarStocks(codigo, payload);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

async function sincronizarStockExport(req, res, next) {
  try {
    if (!req.file?.buffer) {
      throw new Error('Adjunta el Excel exportado de la web (campo "archivo").');
    }
    const resultado = await productoService.sincronizarStockDesdeExportBuffer(
      req.file.buffer
    );
    res.json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

async function resumenStockVsReal(req, res, next) {
  try {
    const resumen = await productoService.obtenerResumenDiscrepanciasStock();
    res.json({ ok: true, resumen });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  buscarProducto,
  buscarPorOcr,
  guardarStocks,
  sincronizarStockExport,
  resumenStockVsReal
};
