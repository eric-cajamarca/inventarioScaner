const {
  construirMapaMovimientosDesdeBuffer
} = require("../utils/movimientoExcelMap");

/**
 * Inventario / stock al corte (p. ej. 30 mayo). Empareja por Producto.
 * La cantidad es el stock al inicio del período.
 */
function leerMapaStockAnterior(buffer) {
  const { mapa, meta } = construirMapaMovimientosDesdeBuffer(
    buffer,
    "stock anterior",
    { permitirColumnaStock: true }
  );
  const mapaNorm = new Map();
  for (const [clave, datos] of mapa) {
    mapaNorm.set(clave, {
      codigo: datos.codigo || "",
      producto: datos.producto || "",
      stockAnterior: datos.cantidad
    });
  }
  return {
    mapa: mapaNorm,
    meta: {
      ...meta,
      archivo: "stock anterior",
      productosUnicos: mapaNorm.size
    }
  };
}

function leerMapaMovimientos(buffer, etiqueta) {
  return construirMapaMovimientosDesdeBuffer(buffer, etiqueta);
}

function leerMapaStockActualSistema(buffer) {
  const {
    construirMapaStockDesdeExportBuffer
  } = require("../utils/stockExportMap");
  const { mapa, filasPorClave, meta } = construirMapaStockDesdeExportBuffer(
    buffer,
    { soloColumnaStockExacta: true, emparejarPorProducto: true }
  );
  const mapaNorm = new Map();

  for (const [clave, stock] of mapa) {
    const datos = filasPorClave.get(clave);
    mapaNorm.set(clave, {
      codigo: datos?.codigo || "",
      producto: datos?.producto || "",
      categoria: datos?.categoria || "",
      marca: datos?.marca || "",
      unidadMedida: datos?.unidadMedida || "",
      almacen: datos?.almacen || "",
      cantidad: stock
    });
  }

  return {
    mapa: mapaNorm,
    meta: {
      ...meta,
      filasProcesadas: meta.filasConCodigoYStock,
      productosUnicos: mapaNorm.size,
      formato: "export-sistema-web"
    }
  };
}

module.exports = {
  leerMapaStockAnterior,
  leerMapaMovimientos,
  leerMapaStockActualSistema
};
