const XLSX = require("xlsx");
const { normalizarCodigoParaComparar } = require("./normalizeCodigo");
const {
  normalizarProductoParaComparar,
  prepararNombreProducto
} = require("./normalizeProducto");
const { claveEmparejamientoInventario } = require("./claveEmparejamiento");

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

/**
 * Columna «Stock» del sistema (no «STOCK REAL» ni «Diferencia»).
 * @param {boolean} soloStockExacto Si true, solo acepta encabezado «Stock» (reconciliación).
 */
function indiceColumnaStockExport(filaEncabezado, soloStockExacto = false) {
  for (let i = 0; i < filaEncabezado.length; i++) {
    const t = String(filaEncabezado[i] ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (t === "stock real" || t === "stockreal" || t === "diferencia") {
      continue;
    }
    if (t === "stock") {
      return i;
    }
  }
  if (soloStockExacto) {
    return -1;
  }
  const alias = [
    "existencia",
    "cantidad",
    "saldo",
    "disponible",
    "stock disponible",
    "stock actual",
    "cantidad disponible"
  ];
  for (const a of alias) {
    for (let i = 0; i < filaEncabezado.length; i++) {
      const t = String(filaEncabezado[i] ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (t === a) {
        return i;
      }
    }
  }
  return -1;
}

function leerCeldaTexto(fila, idx) {
  if (idx < 0 || !fila) {
    return "";
  }
  const v = fila[idx];
  return v !== undefined && v !== null ? String(v).trim() : "";
}

function indicesDatosProductoExport(encabezado) {
  return {
    producto: indiceEncabezado(encabezado, [
      "Producto",
      "PRODUCTO",
      "Descripcion",
      "Descripción",
      "Nombre",
      "Nombre producto"
    ]),
    categoria: indiceEncabezado(encabezado, [
      "Categoría",
      "Categoria",
      "CATEGORIA"
    ]),
    marca: indiceEncabezado(encabezado, ["Marca", "MARCA"]),
    unidadMedida: indiceEncabezado(encabezado, [
      "UNIDAD MEDIDA",
      "Unidad medida",
      "Unidad Medida",
      "UNIDAD MED",
      "Unidad"
    ]),
    almacen: indiceEncabezado(encabezado, ["Almacen", "Almacén", "ALMACEN"])
  };
}

function parsearStockEnteroNoNegativo(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }
  const n = Number(String(valor).replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  const entero = Math.round(n);
  if (Math.abs(n - entero) > 1e-6) {
    return null;
  }
  return entero;
}

/**
 * Lee la primera hoja del buffer exportado y devuelve Map(claveNormalizada -> stock entero).
 * Duplicados de código en el export: gana la última fila.
 */
function construirMapaStockDesdeExportBuffer(buffer, opciones = {}) {
  const soloStockExacto = Boolean(opciones.soloColumnaStockExacta);
  const emparejarPorProducto = Boolean(opciones.emparejarPorProducto);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("El archivo está vacío o no es válido.");
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const nombreHoja = workbook.SheetNames[0];
  const sheet = workbook.Sheets[nombreHoja];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!aoa.length) {
    throw new Error("El Excel exportado no tiene filas.");
  }

  const encabezado = aoa[0];
  const idxCodigo = indiceEncabezado(encabezado, [
    "Código",
    "Codigo",
    "CODIGO",
    "SKU",
    "Codigo producto",
    "Código producto"
  ]);
  const idxStock = indiceColumnaStockExport(encabezado, soloStockExacto);
  const idxDatos = indicesDatosProductoExport(encabezado);

  if (!emparejarPorProducto && idxCodigo < 0) {
    throw new Error(
      "En el export no se encontró columna de código (busca: Código, Codigo, SKU…)."
    );
  }
  if (emparejarPorProducto && idxDatos.producto < 0) {
    throw new Error(
      "En el export no se encontró columna Producto (necesaria para emparejar por nombre)."
    );
  }
  if (idxStock < 0) {
    throw new Error(
      soloStockExacto
        ? 'En el export de stock actual debe existir la columna «Stock» (no uses «STOCK REAL» para la comparación).'
        : "En el export no se encontró columna de stock (busca: Stock, Existencia, Cantidad, Saldo…)."
    );
  }

  const mapa = new Map();
  const filasPorClave = new Map();
  let filasExportProcesadas = 0;
  let filasExportOmitidas = 0;
  let nombresDuplicados = 0;

  for (let r = 1; r < aoa.length; r++) {
    const fila = aoa[r];
    if (!fila || !fila.length) {
      continue;
    }
    const codRaw = idxCodigo >= 0 ? fila[idxCodigo] : "";
    const productoTexto = prepararNombreProducto(leerCeldaTexto(fila, idxDatos.producto));
    const codigoStr =
      codRaw != null && String(codRaw).trim() !== "" ? String(codRaw).trim() : "";
    let clave;
    if (emparejarPorProducto) {
      clave = claveEmparejamientoInventario(codigoStr, productoTexto);
    } else {
      clave = normalizarCodigoParaComparar(
        codRaw != null ? String(codRaw) : ""
      );
    }
    if (!clave) {
      filasExportOmitidas++;
      continue;
    }
    const stockVal = parsearStockEnteroNoNegativo(fila[idxStock]);
    if (stockVal === null) {
      filasExportOmitidas++;
      continue;
    }

    const datosFila = {
      codigo: codRaw != null && String(codRaw).trim() !== "" ? String(codRaw).trim() : "",
      stock: stockVal,
      producto: productoTexto,
      categoria: leerCeldaTexto(fila, idxDatos.categoria),
      marca: leerCeldaTexto(fila, idxDatos.marca),
      unidadMedida: leerCeldaTexto(fila, idxDatos.unidadMedida),
      almacen: leerCeldaTexto(fila, idxDatos.almacen)
    };

    if (mapa.has(clave)) {
      const acumulado = mapa.get(clave) + stockVal;
      mapa.set(clave, acumulado);
      const prev = filasPorClave.get(clave);
      datosFila.stock = acumulado;
      if (!datosFila.codigo && prev?.codigo) {
        datosFila.codigo = prev.codigo;
      }
      if (!datosFila.producto && prev?.producto) {
        datosFila.producto = prev.producto;
      }
      filasPorClave.set(clave, datosFila);
      nombresDuplicados += 1;
    } else {
      mapa.set(clave, stockVal);
      filasPorClave.set(clave, datosFila);
    }
    filasExportProcesadas++;
  }

  if (mapa.size === 0) {
    throw new Error(
      emparejarPorProducto
        ? "No hay filas válidas en el export (producto + stock numérico entero ≥ 0)."
        : "No hay filas válidas en el export (código + stock numérico entero ≥ 0)."
    );
  }

  return {
    mapa,
    filasPorClave,
    meta: {
      nombreHojaExport: nombreHoja,
      criterioEmparejamiento: emparejarPorProducto
        ? "Código (prioritario) o Producto"
        : "Código",
      encabezadoCodigo:
        idxCodigo >= 0 ? String(encabezado[idxCodigo] ?? "").trim() : "(opcional)",
      encabezadoProducto:
        idxDatos.producto >= 0
          ? String(encabezado[idxDatos.producto] ?? "").trim()
          : "",
      encabezadoStock: String(encabezado[idxStock] ?? "").trim(),
      filasConCodigoYStock: filasExportProcesadas,
      filasOmitidas: filasExportOmitidas,
      filasNombreDuplicado: nombresDuplicados
    }
  };
}

module.exports = {
  construirMapaStockDesdeExportBuffer
};
