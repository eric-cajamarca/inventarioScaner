const productoRepository = require("../repositories/producto.repository");
const { buscarCoincidenciasAproximadas } = require("../utils/fuzzySearch");
const { extraerCandidatosDesdeTexto } = require("../utils/ocrExtract");
const {
  normalizarCodigoParaComparar
} = require("../utils/normalizeCodigo");

function limpiarCodigo(codigo) {
  return String(codigo || "").trim();
}

function coincidenciaExactaCodigo(productos, codigoLimpio) {
  const clave = normalizarCodigoParaComparar(codigoLimpio);
  if (!clave) {
    return null;
  }
  return (
    productos.find(
      (item) => normalizarCodigoParaComparar(item.codigo) === clave
    ) || null
  );
}

function fusionarResultadosUnicos(exacta, fuzzyLista, limite = 30) {
  const vistos = new Set();
  const resultados = [];
  if (exacta) {
    resultados.push(exacta);
    vistos.add(normalizarCodigoParaComparar(exacta.codigo));
  }
  for (const p of fuzzyLista) {
    const k = normalizarCodigoParaComparar(p.codigo);
    if (vistos.has(k)) {
      continue;
    }
    vistos.add(k);
    resultados.push(p);
    if (resultados.length >= limite) {
      break;
    }
  }
  return resultados;
}

async function buscarPorCodigo(codigo) {
  const codigoLimpio = limpiarCodigo(codigo);
  if (!codigoLimpio) {
    throw new Error("Ingresa un término de búsqueda.");
  }

  const inicio = Date.now();
  const productos = productoRepository.obtenerProductosDesdeExcel();
  const exacta = coincidenciaExactaCodigo(productos, codigoLimpio);
  const terminoFuzzy =
    limpiarCodigo(codigoLimpio.replace(/[\s\u00A0]+/g, " ")) || codigoLimpio;
  const fuzzy = buscarCoincidenciasAproximadas(productos, terminoFuzzy, 40);
  const resultados = fusionarResultadosUnicos(exacta, fuzzy, 30);

  return {
    resultados,
    meta: {
      tiempoMs: Date.now() - inicio,
      totalCatalogo: productos.length,
      coincidenciaExactaCodigo: Boolean(exacta),
      totalMostrados: resultados.length
    }
  };
}

function fusionarSimilares(productos, terminos, limite = 5) {
  const vistos = new Set();
  const salida = [];

  for (const termino of terminos) {
    if (!termino) {
      continue;
    }
    const hallados = buscarCoincidenciasAproximadas(
      productos,
      termino,
      limite + 3
    );
    for (const item of hallados) {
      const k = String(item.codigo);
      if (!vistos.has(k)) {
        vistos.add(k);
        salida.push(item);
      }
      if (salida.length >= limite) {
        return salida;
      }
    }
  }
  return salida.slice(0, limite);
}

async function buscarPorTextoOcr(texto) {
  const textoLimpio = String(texto || "").trim();
  if (!textoLimpio) {
    throw new Error("El campo texto es obligatorio para búsqueda OCR.");
  }

  const inicio = Date.now();
  const productos = productoRepository.obtenerProductosDesdeExcel();
  const candidatos = extraerCandidatosDesdeTexto(textoLimpio);

  for (const c of candidatos) {
    const exacta = coincidenciaExactaCodigo(productos, c);
    if (exacta) {
      const fuzzyExtra = buscarCoincidenciasAproximadas(
        productos,
        textoLimpio.replace(/\s+/g, " ").trim(),
        35
      );
      const resultados = fusionarResultadosUnicos(exacta, fuzzyExtra, 30);
      return {
        resultados,
        meta: {
          tiempoMs: Date.now() - inicio,
          totalCatalogo: productos.length,
          modo: "ocr",
          candidatosOcr: candidatos,
          candidatoCoincidente: c,
          coincidenciaExactaCodigo: true,
          totalMostrados: resultados.length
        }
      };
    }
  }

  const terminosBusqueda = [
    ...candidatos,
    textoLimpio.replace(/\s+/g, " ").trim()
  ];
  const similares = fusionarSimilares(productos, terminosBusqueda, 35);
  const resultados = fusionarResultadosUnicos(null, similares, 30);

  return {
    resultados,
    meta: {
      tiempoMs: Date.now() - inicio,
      totalCatalogo: productos.length,
      modo: "ocr",
      candidatosOcr: candidatos,
      coincidenciaExactaCodigo: false,
      totalMostrados: resultados.length
    }
  };
}

function validarEnteroNoNegativo(valor, nombreCampo) {
  const n = Number(valor);
  if (!Number.isFinite(n)) {
    throw new Error(`${nombreCampo} debe ser un número válido.`);
  }
  if (n < 0) {
    throw new Error(`${nombreCampo} no puede ser negativo.`);
  }
  if (n > 1e9) {
    throw new Error(`${nombreCampo} demasiado grande.`);
  }
  const entero = Math.round(n);
  if (Math.abs(n - entero) > 1e-9) {
    throw new Error(`${nombreCampo} debe ser un número entero.`);
  }
  return entero;
}

/**
 * Guarda en Excel solo las columnas enviadas en el body.
 * - Solo `stockReal`: actualiza únicamente STOCK REAL (Stock del catálogo no se modifica).
 * - Solo `stock`: actualiza únicamente Stock.
 * - Ambos: actualiza las dos.
 */
async function actualizarStocks(codigo, payload) {
  const codigoLimpio = limpiarCodigo(codigo);
  if (!codigoLimpio) {
    throw new Error("El código es obligatorio.");
  }

  const tieneStock = Object.prototype.hasOwnProperty.call(payload, "stock");
  const tieneReal = Object.prototype.hasOwnProperty.call(payload, "stockReal");
  const tieneProducto = Object.prototype.hasOwnProperty.call(
    payload,
    "producto"
  );

  if (!tieneStock && !tieneReal) {
    throw new Error("Envía stock y/o stockReal para guardar.");
  }

  if (tieneProducto && !tieneReal) {
    throw new Error(
      "La descripción (producto) solo se guarda junto con stock real."
    );
  }

  const actualizaciones = {};
  if (tieneStock) {
    actualizaciones.stock = validarEnteroNoNegativo(payload.stock, "Stock");
  }
  if (tieneReal) {
    actualizaciones.stockReal = validarEnteroNoNegativo(
      payload.stockReal,
      "Stock real"
    );
  }
  if (tieneReal && tieneProducto) {
    const desc = String(payload.producto ?? "").trim();
    if (desc.length > 4000) {
      throw new Error("La descripción no puede superar 4000 caracteres.");
    }
    actualizaciones.producto = desc;
  }

  const actualizado = productoRepository.actualizarStocksPorCodigo(
    codigoLimpio,
    actualizaciones
  );

  return {
    producto: actualizado,
    stockGuardado: tieneStock ? actualizaciones.stock : undefined,
    stockRealGuardado: tieneReal ? actualizaciones.stockReal : undefined,
    productoGuardado:
      tieneReal && tieneProducto ? actualizaciones.producto : undefined
  };
}

async function sincronizarStockDesdeExportBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error("No se recibió ningún archivo.");
  }
  return productoRepository.sincronizarStockCatalogoDesdeExportBuffer(buffer);
}

module.exports = {
  buscarPorCodigo,
  buscarPorTextoOcr,
  actualizarStocks,
  sincronizarStockDesdeExportBuffer
};
