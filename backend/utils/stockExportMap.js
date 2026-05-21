const XLSX = require("xlsx");
const { normalizarCodigoParaComparar } = require("./normalizeCodigo");

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
 * Columna de stock en el export (evita confundir con "STOCK REAL").
 */
function indiceColumnaStockExport(filaEncabezado) {
  for (let i = 0; i < filaEncabezado.length; i++) {
    const t = String(filaEncabezado[i] ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (t === "stock real" || t === "stockreal") {
      continue;
    }
    if (t === "stock") {
      return i;
    }
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
function construirMapaStockDesdeExportBuffer(buffer) {
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
  const idxStock = indiceColumnaStockExport(encabezado);

  if (idxCodigo < 0) {
    throw new Error(
      "En el export no se encontró columna de código (busca: Código, Codigo, SKU…)."
    );
  }
  if (idxStock < 0) {
    throw new Error(
      "En el export no se encontró columna de stock (busca: Stock, Existencia, Cantidad, Saldo…)."
    );
  }

  const mapa = new Map();
  const filasPorClave = new Map();
  const idxDatos = indicesDatosProductoExport(encabezado);
  let filasExportProcesadas = 0;
  let filasExportOmitidas = 0;

  for (let r = 1; r < aoa.length; r++) {
    const fila = aoa[r];
    if (!fila || !fila.length) {
      continue;
    }
    const codRaw = fila[idxCodigo];
    const clave = normalizarCodigoParaComparar(
      codRaw != null ? String(codRaw) : ""
    );
    if (!clave) {
      filasExportOmitidas++;
      continue;
    }
    const stockVal = parsearStockEnteroNoNegativo(fila[idxStock]);
    if (stockVal === null) {
      filasExportOmitidas++;
      continue;
    }
    mapa.set(clave, stockVal);
    filasPorClave.set(clave, {
      codigo: codRaw != null ? String(codRaw).trim() : "",
      stock: stockVal,
      producto: leerCeldaTexto(fila, idxDatos.producto),
      categoria: leerCeldaTexto(fila, idxDatos.categoria),
      marca: leerCeldaTexto(fila, idxDatos.marca),
      unidadMedida: leerCeldaTexto(fila, idxDatos.unidadMedida),
      almacen: leerCeldaTexto(fila, idxDatos.almacen)
    });
    filasExportProcesadas++;
  }

  if (mapa.size === 0) {
    throw new Error(
      "No hay filas válidas en el export (código + stock numérico entero ≥ 0)."
    );
  }

  return {
    mapa,
    filasPorClave,
    meta: {
      nombreHojaExport: nombreHoja,
      encabezadoCodigo: String(encabezado[idxCodigo] ?? "").trim(),
      encabezadoStock: String(encabezado[idxStock] ?? "").trim(),
      filasConCodigoYStock: filasExportProcesadas,
      filasOmitidas: filasExportOmitidas
    }
  };
}

module.exports = {
  construirMapaStockDesdeExportBuffer
};
