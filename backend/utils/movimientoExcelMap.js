const XLSX = require("xlsx");
const {
  normalizarProductoParaComparar,
  prepararNombreProducto
} = require("./normalizeProducto");
const { claveEmparejamientoInventario } = require("./claveEmparejamiento");

const ENCABEZADOS_PRODUCTO = [
  "Producto",
  "PRODUCTO",
  "producto",
  "Descripción",
  "Descripcion",
  "DESCRIPCION",
  "Artículo",
  "Articulo",
  "ARTICULO",
  "Nombre",
  "Nombre producto",
  "Nombre Producto",
  "Detalle",
  "Detalle producto"
];

const ENCABEZADOS_CANTIDAD = [
  "Cantidad",
  "CANTIDAD",
  "cantidad",
  "Unidades",
  "UNIDADES",
  "Cant",
  "Cant.",
  "Qty",
  "qty",
  "QTY",
  "Cantidad comprada",
  "Cantidad Compra",
  "Cant Compra",
  "Cant. Compra",
  "Entrada",
  "Entradas",
  "Cantidad doc",
  "Cant Doc",
  "Cantidad movimiento",
  "Cant Mov",
  "Salida",
  "Salidas",
  "Cantidad vendida",
  "Cant Venta",
  "Cant. Venta"
];

function indiceEncabezado(filaEncabezado, nombresPosibles) {
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

function indiceColumnaCantidad(filaEncabezado, opciones = {}) {
  const permitirStock = Boolean(opciones.permitirColumnaStock);
  const preferidos = [
    "Cantidad",
    "CANTIDAD",
    "cantidad",
    "Unidades",
    "UNIDADES",
    "Cant",
    "Cant.",
    "Qty",
    "qty",
    "QTY",
    "Cantidad comprada",
    "Cantidad Compra",
    "Cant Compra",
    "Cant. Compra",
    "Entrada",
    "Entradas",
    "Cantidad doc",
    "Cant Doc",
    "Cantidad movimiento",
    "Cant Mov",
    "Salida",
    "Salidas",
    "Cantidad vendida",
    "Cant Venta",
    "Cant. Venta"
  ];
  if (permitirStock) {
    preferidos.push("Stock", "STOCK", "stock");
  }

  let mejorIdx = -1;
  let mejorPrioridad = Infinity;
  for (let i = 0; i < filaEncabezado.length; i++) {
    const celda = String(filaEncabezado[i] ?? "").trim();
    if (!celda) {
      continue;
    }
    const celdaLow = celda.toLowerCase();
    for (let p = 0; p < preferidos.length; p++) {
      if (celdaLow === preferidos[p].toLowerCase()) {
        if (p < mejorPrioridad) {
          mejorPrioridad = p;
          mejorIdx = i;
        }
        break;
      }
    }
  }
  return mejorIdx;
}

function detectarFilaEncabezado(aoa, opciones = {}) {
  const maxScan = Math.min(20, aoa.length);
  for (let r = 0; r < maxScan; r++) {
    const fila = aoa[r];
    if (!fila || !fila.length) {
      continue;
    }
    const idxProducto = indiceEncabezado(fila, ENCABEZADOS_PRODUCTO);
    const idxCantidad = indiceColumnaCantidad(fila, opciones);
    if (idxProducto >= 0 && idxCantidad >= 0) {
      return r;
    }
  }
  return 0;
}

function parsearCantidadEntera(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }
  let s = String(valor).trim().replace(/\s/g, "");
  if (!s) {
    return null;
  }
  if (/^\d+,\d+$/.test(s)) {
    s = s.split(",")[0];
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  const entero = Math.round(n);
  if (Math.abs(n - entero) > 1e-6) {
    return null;
  }
  return entero;
}

function leerCeldaTexto(fila, idx) {
  if (idx < 0 || !fila) {
    return "";
  }
  const v = fila[idx];
  return v !== undefined && v !== null ? String(v).trim() : "";
}

/**
 * Lee Excel con columnas Producto y Cantidad (Código opcional).
 * Usado por compras, ventas y stock anterior: reparación de tildes/ñ corruptas
 * vía prepararNombreProducto. Empareja por código (si existe) o por nombre.
 */
function construirMapaMovimientosDesdeBuffer(buffer, etiquetaArchivo, opciones = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(`El archivo ${etiquetaArchivo} está vacío o no es válido.`);
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const nombreHoja = workbook.SheetNames[0];
  const sheet = workbook.Sheets[nombreHoja];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!aoa.length) {
    throw new Error(`El archivo ${etiquetaArchivo} no tiene filas.`);
  }

  const filaEncabezadoIdx = detectarFilaEncabezado(aoa, opciones);
  const encabezado = aoa[filaEncabezadoIdx];
  const idxCodigo = indiceEncabezado(encabezado, [
    "Código",
    "Codigo",
    "CODIGO",
    "codigo",
    "SKU",
    "Cod producto",
    "Cod. producto"
  ]);
  const idxProducto = indiceEncabezado(encabezado, ENCABEZADOS_PRODUCTO);
  const idxCantidad = indiceColumnaCantidad(encabezado, opciones);

  if (idxProducto < 0) {
    throw new Error(
      `En ${etiquetaArchivo} falta la columna Producto (o Descripción / Artículo).`
    );
  }
  if (idxCantidad < 0) {
    throw new Error(
      `En ${etiquetaArchivo} falta la columna Cantidad (o Unidades / Cant).`
    );
  }

  const mapa = new Map();
  let filasProcesadas = 0;
  let filasOmitidas = 0;
  let nombresDuplicados = 0;

  for (let r = filaEncabezadoIdx + 1; r < aoa.length; r++) {
    const fila = aoa[r];
    if (!fila || !fila.length) {
      continue;
    }
    const producto = prepararNombreProducto(leerCeldaTexto(fila, idxProducto));
    const codRaw = idxCodigo >= 0 ? fila[idxCodigo] : "";
    const codigo = codRaw != null && String(codRaw).trim() !== ""
      ? String(codRaw).trim()
      : "";
    const clave = claveEmparejamientoInventario(codigo, producto);
    if (!clave) {
      filasOmitidas++;
      continue;
    }
    const cantidad = parsearCantidadEntera(fila[idxCantidad]);
    if (cantidad === null) {
      filasOmitidas++;
      continue;
    }

    if (mapa.has(clave)) {
      const prev = mapa.get(clave);
      prev.cantidad += cantidad;
      if (!prev.codigo && codigo) {
        prev.codigo = codigo;
      }
      nombresDuplicados += 1;
    } else {
      mapa.set(clave, { codigo, producto, cantidad });
    }
    filasProcesadas++;
  }

  return {
    mapa,
    meta: {
      nombreHoja,
      filaEncabezado: filaEncabezadoIdx + 1,
      criterioEmparejamiento: "Producto",
      encabezadoCodigo:
        idxCodigo >= 0 ? String(encabezado[idxCodigo] ?? "").trim() : "(opcional)",
      encabezadoProducto: String(encabezado[idxProducto] ?? "").trim(),
      encabezadoCantidad: String(encabezado[idxCantidad] ?? "").trim(),
      filasProcesadas,
      filasOmitidas,
      filasNombreDuplicado: nombresDuplicados,
      productosUnicos: mapa.size
    }
  };
}

module.exports = {
  construirMapaMovimientosDesdeBuffer,
  ENCABEZADOS_PRODUCTO,
  ENCABEZADOS_CANTIDAD
};
