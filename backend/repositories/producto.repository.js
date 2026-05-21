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

  const verificadoRaw = primerValor(fila, [
    "Verificado",
    "VERIFICADO",
    "verificado"
  ]);

  return {
    codigo,
    producto,
    categoria,
    marca,
    unidadMedida,
    almacen,
    stock: Number.isFinite(stockNum) ? stockNum : stockRaw,
    stockReal: Number.isFinite(stockRealNum) ? stockRealNum : stockRealRaw,
    modificacion: modificacion || undefined,
    verificado: celdaVerificadoEsSi(verificadoRaw)
  };
}

function celdaVerificadoEsSi(raw) {
  if (raw === true || raw === 1) {
    return true;
  }
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) {
    return false;
  }
  return ["sí", "si", "1", "true", "yes", "x", "verificado", "ok", "v"].includes(s);
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

/** Entero redondeado o null si no es número finito (misma idea que en sincronizar stock). */
function enteroStockONull(celda) {
  const n = Number(celda);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * True si la celda Modificacion parece un registro de fecha/hora (guardado al verificar stock real
 * o fecha típica de Excel). Evita sobrescribir Stock en sincronización cuando ya hubo verificación.
 */
function modificacionIndicaVerificado(celda) {
  if (celda === undefined || celda === null) {
    return false;
  }
  if (
    typeof celda === "number" &&
    Number.isFinite(celda) &&
    celda >= 30000 &&
    celda < 1e7
  ) {
    return true;
  }
  const s = String(celda).trim();
  if (!s) {
    return false;
  }
  if (/\d{4}-\d{2}-\d{2}/.test(s) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) {
    return true;
  }
  return false;
}

function stockRealCeldaEsVacia(celda) {
  if (celda === undefined || celda === null) {
    return true;
  }
  return String(celda).trim() === "";
}

/**
 * Cuenta productos con código: compara Stock vs STOCK REAL.
 * No cuenta filas con STOCK REAL vacío. Stock vacío o no numérico se trata como 0.
 * Positiva: STOCK REAL mayor que Stock. Negativa: STOCK REAL menor que Stock. Conforme: iguales.
 */
function resumenDiscrepanciasStockVsRealAoA(aoa) {
  const sinDatos = {
    disponible: false,
    productosDiferenciaNegativa: 0,
    productosDiferenciaPositiva: 0,
    productosStockConforme: 0,
    productosVerificados: 0,
    listaDiferenciaNegativa: [],
    listaDiferenciaPositiva: []
  };
  if (!aoa || !aoa.length) {
    return sinDatos;
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
  const idxVerificado = indiceColumnaEncabezado(encabezado, [
    "Verificado",
    "VERIFICADO",
    "verificado"
  ]);
  if (idxCodigo < 0 || idxStockCat < 0 || idxStockReal < 0) {
    return sinDatos;
  }
  const maxIdx = Math.max(
    idxCodigo,
    idxStockCat,
    idxStockReal,
    idxVerificado >= 0 ? idxVerificado : -1
  );
  let productosDiferenciaNegativa = 0;
  let productosDiferenciaPositiva = 0;
  let productosStockConforme = 0;
  let productosVerificados = 0;
  const listaDiferenciaNegativa = [];
  const listaDiferenciaPositiva = [];
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
    while (fila.length <= maxIdx) {
      fila.push("");
    }
    if (idxVerificado >= 0 && celdaVerificadoEsSi(fila[idxVerificado])) {
      productosVerificados += 1;
    }
    const celdaReal = fila[idxStockReal];
    if (stockRealCeldaEsVacia(celdaReal)) {
      continue;
    }
    const realNum = enteroStockONull(celdaReal);
    if (realNum === null) {
      continue;
    }
    const stockNumRaw = enteroStockONull(fila[idxStockCat]);
    const stockVal = stockNumRaw === null ? 0 : stockNumRaw;
    if (realNum === stockVal) {
      productosStockConforme += 1;
    } else if (realNum > stockVal) {
      productosDiferenciaPositiva += 1;
      listaDiferenciaPositiva.push(productoDesdeFilaAoA(encabezado, fila));
    } else {
      productosDiferenciaNegativa += 1;
      listaDiferenciaNegativa.push(productoDesdeFilaAoA(encabezado, fila));
    }
  }
  return {
    disponible: true,
    productosDiferenciaNegativa,
    productosDiferenciaPositiva,
    productosStockConforme,
    productosVerificados,
    listaDiferenciaNegativa,
    listaDiferenciaPositiva
  };
}

function obtenerResumenDiscrepanciasStockDesdeExcel() {
  const workbook = XLSX.readFile(EXCEL_PATH, { dense: false, cellDates: false });
  const nombreHoja = workbook.SheetNames[0];
  const sheet = workbook.Sheets[nombreHoja];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const totalProductosRegistrados = obtenerProductosDesdeExcel().length;
  return {
    ...resumenDiscrepanciasStockVsRealAoA(aoa),
    totalProductosRegistrados
  };
}

/**
 * @param {"negativa"|"positiva"} tipo
 */
function obtenerListaDiscrepanciaStockVsRealDesdeExcel(tipo) {
  const t = String(tipo || "").trim().toLowerCase();
  if (t !== "negativa" && t !== "positiva") {
    throw new Error('Parámetro "tipo" debe ser "negativa" o "positiva".');
  }
  const workbook = XLSX.readFile(EXCEL_PATH, { dense: false, cellDates: false });
  const nombreHoja = workbook.SheetNames[0];
  const sheet = workbook.Sheets[nombreHoja];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const resumen = resumenDiscrepanciasStockVsRealAoA(aoa);
  if (!resumen.disponible) {
    throw new Error(
      "No se puede listar: en el catálogo hacen falta las columnas Código, Stock y STOCK REAL."
    );
  }
  return t === "negativa"
    ? resumen.listaDiferenciaNegativa || []
    : resumen.listaDiferenciaPositiva || [];
}

/**
 * Actualiza solo las columnas indicadas. No toca Stock si no envías `stock`;
 * no toca STOCK REAL si no envías `stockReal`.
 * Si envías `producto` junto con `stockReal`, actualiza la columna Producto (descripción).
 * `verificado` true escribe «Sí» en la columna Verificado; false deja la celda vacía.
 */
function actualizarStocksPorCodigo(codigoBusqueda, updates) {
  const { stock, stockReal, producto, verificado } = updates;
  const escribirStock = stock !== undefined && stock !== null;
  const escribirReal = stockReal !== undefined && stockReal !== null;
  const escribirProducto =
    escribirReal &&
    Object.prototype.hasOwnProperty.call(updates, "producto");
  const escribirVerificado = Object.prototype.hasOwnProperty.call(
    updates,
    "verificado"
  );
  if (!escribirStock && !escribirReal && !escribirVerificado) {
    throw new Error(
      "No hay valores para guardar (stock, stockReal o verificado)."
    );
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

  let idxVerificado = indiceColumnaEncabezado(encabezado, [
    "Verificado",
    "VERIFICADO",
    "verificado"
  ]);
  if (escribirVerificado && idxVerificado < 0) {
    idxVerificado = encabezado.length;
    encabezado.push("Verificado");
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
  if (escribirVerificado) {
    indices.push(idxVerificado);
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
      if (escribirVerificado) {
        fila[idxVerificado] = verificado === true ? "Sí" : "";
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
 * Crea una fila nueva en el catálogo a partir de datos del export (código, stock y columnas opcionales).
 */
function crearFilaCatalogoDesdeExport(encabezado, indices, datosExport) {
  const fila = new Array(encabezado.length).fill("");
  const escribir = (idx, valor) => {
    if (idx < 0 || valor === undefined || valor === null) {
      return;
    }
    const s = String(valor).trim();
    if (s !== "") {
      fila[idx] = valor;
    }
  };
  escribir(indices.codigo, datosExport.codigo);
  escribir(indices.stock, datosExport.stock);
  escribir(indices.producto, datosExport.producto);
  escribir(indices.categoria, datosExport.categoria);
  escribir(indices.marca, datosExport.marca);
  escribir(indices.unidadMedida, datosExport.unidadMedida);
  escribir(indices.almacen, datosExport.almacen);
  return fila;
}

/**
 * Actualiza la columna Stock (catálogo) en productos.xlsx usando un Excel exportado
 * desde otro sistema. Agrega filas nuevas para códigos del export que no existan en el catálogo.
 */
function sincronizarStockCatalogoDesdeExportBuffer(buffer) {
  const { mapa, filasPorClave, meta: metaExport } =
    construirMapaStockDesdeExportBuffer(buffer);

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

  const idxStockReal = indiceColumnaEncabezado(encabezado, [
    "STOCK REAL",
    "Stock real",
    "Stock Real"
  ]);
  const idxModificacion = indiceColumnaEncabezado(encabezado, [
    "Modificacion",
    "Modificación",
    "MODIFICACION",
    "modificacion"
  ]);

  const maxCol = Math.max(
    idxCodigo,
    idxStockCat,
    idxStockReal >= 0 ? idxStockReal : -1,
    idxModificacion >= 0 ? idxModificacion : -1
  );
  let filasCatalogoConStockDelExport = 0;
  let filasStockValorCambiado = 0;
  let filasStockSinCambio = 0;
  let filasStockOmitidasPorVerificacion = 0;
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
    const stockCat = enteroStockONull(fila[idxStockCat]);
    const stockRealCat =
      idxStockReal >= 0 ? enteroStockONull(fila[idxStockReal]) : null;
    const omitirPorVerificado =
      idxStockReal >= 0 &&
      idxModificacion >= 0 &&
      stockCat !== null &&
      stockRealCat !== null &&
      stockCat === stockRealCat &&
      modificacionIndicaVerificado(fila[idxModificacion]);

    if (omitirPorVerificado) {
      filasStockOmitidasPorVerificacion++;
      continue;
    }

    const anterior = fila[idxStockCat];
    const valAnt = enteroStockONull(anterior);
    const mismo = valAnt === nuevo;
    fila[idxStockCat] = nuevo;
    if (mismo) {
      filasStockSinCambio++;
    } else {
      filasStockValorCambiado++;
    }
  }

  const clavesNuevasEnExport = [...mapa.keys()].filter((k) => !clavesUsadas.has(k));

  const indicesCatalogo = {
    codigo: idxCodigo,
    stock: idxStockCat,
    producto: indiceColumnaEncabezado(encabezado, [
      "Producto",
      "PRODUCTO",
      "producto"
    ]),
    categoria: indiceColumnaEncabezado(encabezado, [
      "Categoría",
      "Categoria",
      "CATEGORIA"
    ]),
    marca: indiceColumnaEncabezado(encabezado, ["Marca", "MARCA", "marca"]),
    unidadMedida: indiceColumnaEncabezado(encabezado, [
      "UNIDAD MEDIDA",
      "Unidad medida",
      "Unidad Medida"
    ]),
    almacen: indiceColumnaEncabezado(encabezado, [
      "Almacen",
      "Almacén",
      "ALMACEN"
    ])
  };

  let productosNuevosAgregados = 0;
  const codigosProductosNuevos = [];
  const clavesSinAgregar = [];

  for (const clave of clavesNuevasEnExport) {
    const datos = filasPorClave.get(clave);
    if (!datos) {
      clavesSinAgregar.push(clave);
      continue;
    }
    aoa.push(crearFilaCatalogoDesdeExport(encabezado, indicesCatalogo, datos));
    clavesUsadas.add(clave);
    productosNuevosAgregados += 1;
    if (codigosProductosNuevos.length < 80) {
      codigosProductosNuevos.push(datos.codigo || clave);
    }
  }

  const sinProducto = clavesSinAgregar;
  const archivoCatalogoEscrito =
    filasStockValorCambiado > 0 || productosNuevosAgregados > 0;

  if (archivoCatalogoEscrito) {
    const nuevaHoja = XLSX.utils.aoa_to_sheet(aoa);
    workbook.Sheets[nombreHoja] = nuevaHoja;
    XLSX.writeFile(workbook, EXCEL_PATH, { bookType: "xlsx" });
    invalidateProductosCache();
  }

  const resumenStockVsReal = {
    ...resumenDiscrepanciasStockVsRealAoA(aoa),
    totalProductosRegistrados: obtenerProductosDesdeExcel().length
  };

  return {
    meta: {
      ...metaExport,
      filasCatalogoConCoincidencia: filasCatalogoConStockDelExport,
      filasStockValorCambiado,
      filasStockSinCambio,
      filasStockOmitidasPorVerificacion,
      productosNuevosAgregados,
      codigosProductosNuevos,
      resumenStockVsReal,
      codigosExportSinProductoEnCatalogo: sinProducto.slice(0, 80),
      totalCodigosExportSinProducto: sinProducto.length,
      archivoCatalogoEscrito
    }
  };
}

module.exports = {
  obtenerProductosDesdeExcel,
  actualizarStocksPorCodigo,
  invalidateProductosCache,
  sincronizarStockCatalogoDesdeExportBuffer,
  obtenerResumenDiscrepanciasStockDesdeExcel,
  obtenerListaDiscrepanciaStockVsRealDesdeExcel
};
