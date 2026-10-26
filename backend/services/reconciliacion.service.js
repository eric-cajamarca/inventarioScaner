const reconciliacionRepository = require("../repositories/reconciliacion.repository");
const {
  guardarResultadoReconciliacionEnExcel,
  guardarProductosConStockReal
} = require("../utils/reconciliacionExcelExport");
const {
  construirRegistrosReconciliacion,
  registroAFilaReconciliacion
} = require("../utils/reconciliacionIndex");
const { normalizarCodigoParaComparar } = require("../utils/normalizeCodigo");

/**
 * Empareja por Producto y por Código (ERP distinto en compras/ventas).
 * Stock esperado = Stock anterior + Compras − Ventas.
 */
async function reconciliarMovimientos(buffers) {
  const {
    stockAnterior: bufStockAnterior,
    compras: bufCompras,
    ventas: bufVentas,
    stockActual: bufStockActual
  } = buffers;

  if (!bufStockAnterior?.length) {
    throw new Error("Adjunta el archivo de stock anterior (inventario al corte).");
  }
  if (!bufCompras?.length) {
    throw new Error("Adjunta el archivo de compras.");
  }
  if (!bufVentas?.length) {
    throw new Error("Adjunta el archivo de ventas.");
  }
  if (!bufStockActual?.length) {
    throw new Error("Adjunta el archivo de stock actual del sistema.");
  }

  const { mapa: mapaAnterior, meta: metaAnterior } =
    reconciliacionRepository.leerMapaStockAnterior(bufStockAnterior);
  const { mapa: mapaCompras, meta: metaCompras } =
    reconciliacionRepository.leerMapaMovimientos(bufCompras, "compras");
  const { mapa: mapaVentas, meta: metaVentas } =
    reconciliacionRepository.leerMapaMovimientos(bufVentas, "ventas");
  const { mapa: mapaStockActual, meta: metaStockActual } =
    reconciliacionRepository.leerMapaStockActualSistema(bufStockActual);

  if (mapaAnterior.size === 0) {
    throw new Error("El archivo de stock anterior no tiene filas válidas.");
  }
  if (mapaCompras.size === 0) {
    throw new Error("El archivo de compras no tiene filas válidas.");
  }
  if (mapaVentas.size === 0) {
    throw new Error("El archivo de ventas no tiene filas válidas.");
  }
  if (mapaStockActual.size === 0) {
    throw new Error("El archivo de stock actual no tiene filas válidas.");
  }

  const registros = construirRegistrosReconciliacion({
    mapaAnterior,
    mapaCompras,
    mapaVentas,
    mapaStockActual
  });

  const faltantes = [];
  const sobrantes = [];
  const conformes = [];
  let productosAnalizados = 0;
  let productosConCompras = 0;
  let productosConVentas = 0;
  const stockRealPorCodigo = new Map();

  for (const reg of registros.values()) {
    const stockEsperado = reg.stockAnterior + reg.compras - reg.ventas;
    productosAnalizados += 1;
    if (reg.compras > 0) {
      productosConCompras += 1;
    }
    if (reg.ventas > 0) {
      productosConVentas += 1;
    }

    const fila = registroAFilaReconciliacion(reg);
    if (fila.codigo) {
      const codigoNorm = normalizarCodigoParaComparar(fila.codigo);
      if (codigoNorm) {
        const acumulado = stockRealPorCodigo.get(codigoNorm) ?? 0;
        stockRealPorCodigo.set(codigoNorm, acumulado + fila.stockEsperado);
      }
    }

    if (fila.diferencia < 0) {
      faltantes.push(fila);
    } else if (fila.diferencia > 0) {
      sobrantes.push(fila);
    } else {
      conformes.push(fila);
    }
  }

  faltantes.sort((a, b) => a.diferencia - b.diferencia);
  sobrantes.sort((a, b) => b.diferencia - a.diferencia);

  const meta = {
    stockAnterior: metaAnterior,
    compras: metaCompras,
    ventas: metaVentas,
    stockActual: {
      ...metaStockActual,
      nota:
        "Emparejamiento por Producto y Código. STOCK REAL = Stock anterior + Comprados − Vendidos."
    },
    productosAnalizados,
    productosConCompras,
    productosConVentas,
    productosConformes: conformes.length,
    productosFaltante: faltantes.length,
    productosSobrante: sobrantes.length,
    criterioEmparejamiento: "Código (prioritario) + nombre si el código falta",
    formula:
      "STOCK REAL = Stock anterior + Comprados − Vendidos; Stock = export actual; Diferencia = Stock − STOCK REAL"
  };

  const archivoResultado = guardarResultadoReconciliacionEnExcel({
    faltantes,
    sobrantes,
    conformes,
    meta
  });
  const archivoProductos = guardarProductosConStockReal({
    stockActual: mapaStockActual,
    stockRealPorCodigo
  });

  return {
    meta: {
      ...meta,
      archivoResultado,
      archivoProductos
    },
    faltantes,
    sobrantes,
    conformes
  };
}

module.exports = {
  reconciliarMovimientos
};
