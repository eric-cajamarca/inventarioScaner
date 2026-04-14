const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { normalizarCodigoParaComparar } = require("../utils/normalizeCodigo");
const { invalidateFuseCache } = require("../utils/fuzzySearch");
const {
  construirMapaStockDesdeExportBuffer
} = require("../utils/stockExportMap");

const EXCEL_PATH = path.join(__dirname, "..", "data", "productos.xlsx");

/** Lista de productos en memoria; se invalida si cambia la fecha de modificación del .xlsx */
let cacheProductos = null;
let cacheProductosMtimeMs = null;

function invalidateProductosCache() {
  cacheProductos = null;
  cacheProductosMtimeMs = null;
  invalidateFuseCache();
}

function primerValor(fila, clavesPosibles) {
  for (const clave of clavesPosibles) {
    if (
      Object.prototype.hasOwnProperty.call(fila, clave) &&
      fila[clave] !== undefined &&
      fila[clave] !== null &&
      String(fila[clave]).trim() !== ""
    ) {
      return fila[clave];
    }
  }
  return "";
}

function normalizarProducto(fila) {
  const codigo = String(
    primerValor(fila, ["Código", "Codigo", "CODIGO", "codigo"])
  ).trim();

  const producto = String(
    primerValor(fila, ["Producto", "PRODUCTO", "producto"])
  ).trim();

  const categoria = String(
    primerValor(fila, ["Categoría", "Categoria", "CATEGORIA", "categoria"])
  ).trim();

  const marca = String(
    primerValor(fila, ["Marca", "MARCA", "marca"])
  ).trim();

  const unidadMedida = String(
    primerValor(fila, [
      "UNIDAD MEDIDA",
      "Unidad medida",
      "Unidad Medida",
      "unidadMedida"
    ])
  ).trim();

  const almacen = String(
    primerValor(fila, ["Almacen", "Almacén", "ALMACEN", "almacen"])
  ).trim();

  const stockRaw = primerValor(fila, ["Stock", "STOCK", "stock"]);
  const stockRealRaw = primerValor(fila, [
    "STOCK REAL",
    "Stock real",
    "Stock Real",
    "stockReal"
  ]);

  const stockNum = Number(stockRaw);
  const stockRealNum = Number(stockRealRaw);

  const modificacion = String(
    primerValor(fila, [
      "Modificacion",
      "Modificación",
      "MODIFICACION",
      "modificacion"
    ])
  ).trim();

  return {
    codigo,
    producto,
    categoria,
    marca,
    unidadMedida,
    almacen,
    stock: Number.isFinite(stockNum) ? stockNum : stockRaw,
    stockReal: Number.isFinite(stockRealNum) ? stockRealNum : stockRealRaw,
    modificacion: modificacion || undefined
  };
}

function obtenerProductosDesdeExcel() {
  const stat = fs.statSync(EXCEL_PATH);
  const mtime = stat.mtimeMs;
  if (cacheProductos !== null && cacheProductosMtimeMs === mtime) {
    return cacheProductos;
  }
  const workbook = XLSX.readFile(EXCEL_PATH, { dense: false, cellDates: false });
  const primeraHoja = workbook.SheetNames[0];
  const sheet = workbook.Sheets[primeraHoja];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  cacheProductos = rows.map(normalizarProducto).filter((p) => p.codigo);
  cacheProductosMtimeMs = fs.statSync(EXCEL_PATH).mtimeMs;
  return cacheProductos;
}

/**
 * Construye el objeto normalizado a partir de una fila AoA y encabezados (misma lógica que sheet_to_json).
 */
function productoDesdeFilaAoA(encabezado, fila) {
  const o = {};
  for (let i = 0; i < encabezado.length; i++) {
    const key = encabezado[i];
    if (key === undefined || key === null || String(key).trim() === "") {
      continue;
    }
    o[String(key).trim()] = fila[i] !== undefined ? fila[i] : "";
  }
  return normalizarProducto(o);
}

function indiceColumnaEncabezado(filaEncabezado, nombresPosibles) {
  for (let i = 0; i < filaEncabezado.length; i++) {
    const celda = String(filaEncabezado[i] ?? "").trim();
    for (const n of nombresPosibles) {
      if (celda.toLowerCase() === String(n).trim().toLowerCase()) {
        return i;
      }
    }
  }
  return -1;
}

/** Formato yyyy-mm-dd HH:MM:SS (equivalente a estilo 120 en SQL Server), hora local del servidor. */
function fechaHoraModificacionTexto() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Columna "Stock" del catálogo (no "STOCK REAL").
 */
function indiceColumnaStockCatalogo(filaEncabezado) {
  for (let i = 0; i < filaEncabezado.length; i++) {
    const t = String(filaEncabezado[i] ?? "").trim().toLowerCase();
    if (t === "stock") {
      return i;
    }
  }
  return -1;
}

/**
 * Actualiza solo las columnas indicadas. No toca Stock si no envías `stock`;
 * no toca STOCK REAL si no envías `stockReal`.
 * Si envías `producto` junto con `stockReal`, actualiza la columna Producto (descripción).
 */
function actualizarStocksPorCodigo(codigoBusqueda, updates) {
  const { stock, stockReal, producto } = updates;
  const escribirStock = stock !== undefined && stock !== null;
  const escribirReal = stockReal !== undefined && stockReal !== null;
  const escribirProducto =
    escribirReal &&
    Object.prototype.hasOwnProperty.call(updates, "producto");
  if (!escribirStock && !escribirReal) {
    throw new Error("No hay valores para guardar (stock o stockReal).");
  }

  const workbook = XLSX.readFile(EXCEL_PATH, { dense: false, cellDates: false });
  const nombreHoja = workbook.SheetNames[0];
  const sheet = workbook.Sheets[nombreHoja];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!aoa.length) {
    throw new Error("El archivo Excel no tiene filas.");
  }
  const encabezado = aoa[0];
  const idxCodigo = indiceColumnaEncabezado(encabezado, [
    "Código",
    "Codigo",
    "CODIGO"
  ]);
  const idxStockCat = indiceColumnaStockCatalogo(encabezado);
  const idxStockReal = indiceColumnaEncabezado(encabezado, [
    "STOCK REAL",
    "Stock real",
    "Stock Real"
  ]);

  if (idxCodigo < 0) {
    throw new Error("No se encontró la columna Código en el Excel.");
  }
  if (escribirStock && idxStockCat < 0) {
    throw new Error('No se encontró la columna "Stock" (catálogo) en el Excel.');
  }
  if (escribirReal && idxStockReal < 0) {
    throw new Error("No se encontró la columna STOCK REAL en el Excel.");
  }

  const idxProducto = indiceColumnaEncabezado(encabezado, [
    "Producto",
    "PRODUCTO",
    "producto",
    "Descripción",
    "Descripcion",
    "DESCRIPCION"
  ]);
  if (escribirProducto && idxProducto < 0) {
    throw new Error(
      'No se encontró la columna "Producto" (descripción) en el Excel.'
    );
  }

  let idxModificacion = indiceColumnaEncabezado(encabezado, [
    "Modificacion",
    "Modificación",
    "MODIFICACION",
    "modificacion"
  ]);
  if (escribirReal && idxModificacion < 0) {
    idxModificacion = encabezado.length;
    encabezado.push("Modificacion");
  }

  const indices = [idxCodigo];
  if (escribirStock) {
    indices.push(idxStockCat);
  }
  if (escribirReal) {
    indices.push(idxStockReal);
    indices.push(idxModificacion);
  }
  if (escribirProducto) {
    indices.push(idxProducto);
  }
  const maxCol = Math.max(...indices);

  const clave = normalizarCodigoParaComparar(codigoBusqueda);
  let actualizado = false;

  for (let r = 1; r < aoa.length; r++) {
    const fila = aoa[r];
    if (!fila.length) {
      continue;
    }
    const celdaCod = fila[idxCodigo];
    if (normalizarCodigoParaComparar(celdaCod != null ? String(celdaCod) : "") === clave) {
      while (fila.length <= maxCol) {
        fila.push("");
      }
      if (escribirStock) {
        fila[idxStockCat] = stock;
      }
      if (escribirReal) {
        fila[idxStockReal] = stockReal;
        fila[idxModificacion] = fechaHoraModificacionTexto();
      }
      if (escribirProducto) {
        fila[idxProducto] = String(producto ?? "").trim();
      }
      actualizado = true;

      const nuevaHoja = XLSX.utils.aoa_to_sheet(aoa);
      workbook.Sheets[nombreHoja] = nuevaHoja;
      XLSX.writeFile(workbook, EXCEL_PATH, { bookType: "xlsx" });

      const productoActualizado = productoDesdeFilaAoA(encabezado, fila);
      invalidateProductosCache();

      return productoActualizado;
    }
  }

  if (!actualizado) {
    throw new Error("No existe un producto con ese código en el Excel.");
  }
}

/**
 * Actualiza solo la columna Stock (catálogo) en productos.xlsx usando un Excel exportado
 * desde otro sistema. Mantiene encabezados y demás columnas del archivo en data.
 */
function sincronizarStockCatalogoDesdeExportBuffer(buffer) {
  const { mapa, meta: metaExport } = construirMapaStockDesdeExportBuffer(buffer);

  const workbook = XLSX.readFile(EXCEL_PATH, { dense: false, cellDates: false });
  const nombreHoja = workbook.SheetNames[0];
  const sheet = workbook.Sheets[nombreHoja];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!aoa.length) {
    throw new Error("El archivo de catálogo no tiene filas.");
  }
  const encabezado = aoa[0];
  const idxCodigo = indiceColumnaEncabezado(encabezado, [
    "Código",
    "Codigo",
    "CODIGO"
  ]);
  const idxStockCat = indiceColumnaStockCatalogo(encabezado);

  if (idxCodigo < 0) {
    throw new Error("No se encontró la columna Código en el catálogo.");
  }
  if (idxStockCat < 0) {
    throw new Error(
      'No se encontró la columna "Stock" (catálogo) en el archivo de data.'
    );
  }

  const maxCol = Math.max(idxCodigo, idxStockCat);
  let filasCatalogoConStockDelExport = 0;
  let filasStockValorCambiado = 0;
  let filasStockSinCambio = 0;
  const clavesUsadas = new Set();

  for (let r = 1; r < aoa.length; r++) {
    const fila = aoa[r];
    if (!fila.length) {
      continue;
    }
    const celdaCod = fila[idxCodigo];
    const clave = normalizarCodigoParaComparar(
      celdaCod != null ? String(celdaCod) : ""
    );
    if (!clave) {
      continue;
    }
    if (!mapa.has(clave)) {
      continue;
    }
    clavesUsadas.add(clave);
    filasCatalogoConStockDelExport++;
    while (fila.length <= maxCol) {
      fila.push("");
    }
    const nuevo = mapa.get(clave);
    const anterior = fila[idxStockCat];
    const antNum = Number(anterior);
    const valAnt = Number.isFinite(antNum) ? Math.round(antNum) : null;
    const mismo = valAnt === nuevo;
    fila[idxStockCat] = nuevo;
    if (mismo) {
      filasStockSinCambio++;
    } else {
      filasStockValorCambiado++;
    }
  }

  const sinProducto = [...mapa.keys()].filter((k) => !clavesUsadas.has(k));

  if (filasStockValorCambiado > 0) {
    const nuevaHoja = XLSX.utils.aoa_to_sheet(aoa);
    workbook.Sheets[nombreHoja] = nuevaHoja;
    XLSX.writeFile(workbook, EXCEL_PATH, { bookType: "xlsx" });
    invalidateProductosCache();
  }

  return {
    meta: {
      ...metaExport,
      filasCatalogoConCoincidencia: filasCatalogoConStockDelExport,
      filasStockValorCambiado,
      filasStockSinCambio,
      codigosExportSinProductoEnCatalogo: sinProducto.slice(0, 80),
      totalCodigosExportSinProducto: sinProducto.length,
      archivoCatalogoEscrito: filasStockValorCambiado > 0
    }
  };
}

module.exports = {
  obtenerProductosDesdeExcel,
  actualizarStocksPorCodigo,
  invalidateProductosCache,
  sincronizarStockCatalogoDesdeExportBuffer
};
