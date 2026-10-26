const path = require("path");
const XLSX = require("xlsx");
const { normalizarCodigoParaComparar } = require("./normalizeCodigo");

const RESULTADO_DIR = path.join(__dirname, "..", "data");
const NOMBRE_HOJA_RESULTADO = "Reconciliación";
const NOMBRE_HOJA_PRODUCTOS = "Productos";

const ENCABEZADO_RESULTADO = [
  "Código",
  "Producto",
  "Categoría",
  "Marca",
  "UNIDAD MED",
  "Almacen",
  "Stock anterior",
  "Comprados",
  "Vendidos",
  "Stock",
  "STOCK REAL",
  "Diferencia"
];

const ENCABEZADO_PRODUCTOS = [
  "Código",
  "Producto",
  "Categoría",
  "Marca",
  "UNIDAD MED",
  "Almacen",
  "Stock",
  "STOCK REAL"
];

function obtenerMarcaTiempoArchivo() {
  const ahora = new Date();
  const yyyy = String(ahora.getFullYear());
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd = String(ahora.getDate()).padStart(2, "0");
  const hh = String(ahora.getHours()).padStart(2, "0");
  const mi = String(ahora.getMinutes()).padStart(2, "0");
  const ss = String(ahora.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function construirNombreArchivoResultado() {
  return `reconciliacion_resultado_${obtenerMarcaTiempoArchivo()}.xlsx`;
}

function construirNombreArchivoProductos() {
  return `productos_${obtenerMarcaTiempoArchivo()}.xlsx`;
}

function indiceColumna(encabezado, nombre) {
  const idx = encabezado.findIndex(
    (c) => String(c).trim().toLowerCase() === nombre.toLowerCase()
  );
  return idx;
}

/**
 * Export dedicado: no copia filas del catálogo (evita pisar STOCK REAL del inventario).
 * STOCK REAL = Stock anterior + Compras − Ventas
 */
function guardarResultadoReconciliacionEnExcel(payload) {
  const { faltantes, sobrantes, conformes } = payload;
  const todos = [...faltantes, ...sobrantes, ...conformes];
  todos.sort((a, b) =>
    String(a.codigo || a.producto || "").localeCompare(
      String(b.codigo || b.producto || ""),
      "es"
    )
  );

  const enc = ENCABEZADO_RESULTADO;
  const idxCodigo = indiceColumna(enc, "Código");
  const idxProducto = indiceColumna(enc, "Producto");
  const idxCategoria = indiceColumna(enc, "Categoría");
  const idxMarca = indiceColumna(enc, "Marca");
  const idxUnidad = indiceColumna(enc, "UNIDAD MED");
  const idxAlmacen = indiceColumna(enc, "Almacen");
  const idxStockAnterior = indiceColumna(enc, "Stock anterior");
  const idxCompras = indiceColumna(enc, "Comprados");
  const idxVentas = indiceColumna(enc, "Vendidos");
  const idxStock = indiceColumna(enc, "Stock");
  const idxStockReal = indiceColumna(enc, "STOCK REAL");
  const idxDiferencia = indiceColumna(enc, "Diferencia");

  const filasSalida = [enc];

  for (const item of todos) {
    const fila = new Array(enc.length).fill("");
    fila[idxCodigo] = item.codigo || item.codigoSistema || item.codigoCatalogo || "";
    fila[idxProducto] = item.producto || "";
    fila[idxCategoria] = item.categoria || "";
    fila[idxMarca] = item.marca || "";
    fila[idxUnidad] = item.unidadMedida || "";
    fila[idxAlmacen] = item.almacen || "";
    fila[idxStockAnterior] = item.stockAnterior ?? item.stockBase ?? 0;
    fila[idxCompras] = item.compras ?? 0;
    fila[idxVentas] = item.ventas ?? 0;
    fila[idxStock] = item.stockActual ?? 0;
    fila[idxStockReal] = item.stockEsperado ?? 0;
    fila[idxDiferencia] = item.diferencia ?? 0;
    filasSalida.push(fila);
  }

  const wbOut = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(filasSalida);
  XLSX.utils.book_append_sheet(wbOut, hoja, NOMBRE_HOJA_RESULTADO);
  const nombreArchivo = construirNombreArchivoResultado();
  const resultadoPath = path.join(RESULTADO_DIR, nombreArchivo);
  XLSX.writeFile(wbOut, resultadoPath, { bookType: "xlsx" });

  return {
    rutaAbsoluta: resultadoPath,
    rutaRelativa: `backend/data/${nombreArchivo}`,
    nombreArchivo,
    formato:
      "Stock anterior + Comprados − Vendidos = STOCK REAL; Stock = export actual; Diferencia = Stock − STOCK REAL"
  };
}

function guardarProductosConStockReal(payload) {
  const { stockActual, stockRealPorCodigo } = payload;
  const enc = ENCABEZADO_PRODUCTOS;
  const idxCodigo = indiceColumna(enc, "Código");
  const idxProducto = indiceColumna(enc, "Producto");
  const idxCategoria = indiceColumna(enc, "Categoría");
  const idxMarca = indiceColumna(enc, "Marca");
  const idxUnidad = indiceColumna(enc, "UNIDAD MED");
  const idxAlmacen = indiceColumna(enc, "Almacen");
  const idxStock = indiceColumna(enc, "Stock");
  const idxStockReal = indiceColumna(enc, "STOCK REAL");

  const filasSalida = [enc];
  const filas = Array.from(stockActual.values());
  filas.sort((a, b) =>
    String(a.codigo || a.producto || "").localeCompare(
      String(b.codigo || b.producto || ""),
      "es"
    )
  );

  for (const item of filas) {
    const fila = new Array(enc.length).fill("");
    fila[idxCodigo] = item.codigo || "";
    fila[idxProducto] = item.producto || "";
    fila[idxCategoria] = item.categoria || "";
    fila[idxMarca] = item.marca || "";
    fila[idxUnidad] = item.unidadMedida || "";
    fila[idxAlmacen] = item.almacen || "";
    fila[idxStock] = item.cantidad ?? item.stock ?? 0;
    if (item.codigo) {
      const codigoNorm = normalizarCodigoParaComparar(item.codigo);
      const stockReal = codigoNorm ? stockRealPorCodigo.get(codigoNorm) : undefined;
      if (stockReal !== undefined) {
        fila[idxStockReal] = stockReal;
      }
    }
    filasSalida.push(fila);
  }

  const wbOut = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(filasSalida);
  XLSX.utils.book_append_sheet(wbOut, hoja, NOMBRE_HOJA_PRODUCTOS);
  const nombreArchivo = construirNombreArchivoProductos();
  const resultadoPath = path.join(RESULTADO_DIR, nombreArchivo);
  XLSX.writeFile(wbOut, resultadoPath, { bookType: "xlsx" });

  return {
    rutaAbsoluta: resultadoPath,
    rutaRelativa: `backend/data/${nombreArchivo}`,
    nombreArchivo,
    formato: "Stock actual + STOCK REAL copiado por Código"
  };
}

module.exports = {
  RESULTADO_DIR,
  guardarResultadoReconciliacionEnExcel,
  guardarProductosConStockReal
};
