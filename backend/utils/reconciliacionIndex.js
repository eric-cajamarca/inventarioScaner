const { normalizarCodigoParaComparar } = require("./normalizeCodigo");
const { normalizarProductoParaComparar } = require("./normalizeProducto");
const { claveEmparejamientoInventario } = require("./claveEmparejamiento");

/**
 * Une mapas priorizando código. Compras/ventas se enlazan por nombre
 * si hay un único candidato. Stock anterior/actual solo se unen por nombre
 * si uno de los dos no tiene código (evita CLT-45 / CLT-46).
 */
function construirRegistrosReconciliacion(fuentes) {
  const {
    mapaAnterior,
    mapaCompras,
    mapaVentas,
    mapaStockActual
  } = fuentes;

  const registros = new Map();

  function asegurarRegistro(clave) {
    if (!registros.has(clave)) {
      registros.set(clave, {
        clave,
        stockAnterior: 0,
        compras: 0,
        ventas: 0,
        stockActual: 0,
        codigoAnterior: "",
        codigoCompras: "",
        codigoVentas: "",
        codigoActual: "",
        productoAnterior: "",
        productoCompras: "",
        productoVentas: "",
        productoActual: "",
        categoria: "",
        marca: "",
        unidadMedida: "",
        almacen: ""
      });
    }
    return registros.get(clave);
  }

  function codigoNormDeRegistro(reg) {
    const crudo =
      reg.codigoActual ||
      reg.codigoAnterior ||
      reg.codigoCompras ||
      reg.codigoVentas ||
      "";
    return crudo ? normalizarCodigoParaComparar(crudo) : "";
  }

  function nombreNormalizadoRegistro(reg) {
    const textos = [
      reg.productoActual,
      reg.productoAnterior,
      reg.productoCompras,
      reg.productoVentas
    ];
    for (const t of textos) {
      const n = normalizarProductoParaComparar(t);
      if (n) {
        return n;
      }
    }
    return "";
  }

  function clavesPorNombreExacto(nombreNorm) {
    if (!nombreNorm) {
      return [];
    }
    const claves = [];
    for (const [clave, reg] of registros) {
      if (nombreNormalizadoRegistro(reg) === nombreNorm) {
        claves.push(clave);
      }
    }
    return claves;
  }

  function resolverClaveInventario(codigo, producto) {
    return claveEmparejamientoInventario(codigo, producto);
  }

  function codigoNormalizado(codigo) {
    return codigo ? normalizarCodigoParaComparar(codigo) : "";
  }

  /**
   * Stock anterior / stock actual: código primero; nombre solo si no hay conflicto de códigos.
   */
  function resolverClaveBase(codigo, producto) {
    const codNorm = codigoNormalizado(codigo);
    if (codNorm && registros.has(codNorm)) {
      return codNorm;
    }

    const claveDirecta = resolverClaveInventario(codigo, producto);
    const nombreNorm = normalizarProductoParaComparar(producto);
    const candidatos = clavesPorNombreExacto(nombreNorm);

    if (candidatos.length === 1) {
      const dest = candidatos[0];
      const codDest = codigoNormDeRegistro(registros.get(dest));
      if (!codNorm || !codDest || codNorm === codDest) {
        return dest;
      }
    }

    return claveDirecta;
  }

  /**
   * Compras / ventas: código si ya existe registro; si no, nombre único aunque el código ERP sea distinto.
   */
  function resolverClaveMovimiento(codigo, producto) {
    const codNorm = codigoNormalizado(codigo);
    if (codNorm && registros.has(codNorm)) {
      return codNorm;
    }

    const nombreNorm = normalizarProductoParaComparar(producto);
    const candidatos = clavesPorNombreExacto(nombreNorm);
    if (candidatos.length === 1) {
      return candidatos[0];
    }

    return resolverClaveInventario(codigo, producto);
  }

  function aplicarAnterior(clave, datos) {
    const reg = asegurarRegistro(clave);
    reg.stockAnterior += datos.stockAnterior ?? 0;
    if (datos.codigo) {
      reg.codigoAnterior = datos.codigo;
    }
    if (datos.producto) {
      reg.productoAnterior = datos.producto;
    }
  }

  function aplicarMovimiento(clave, datos, tipo) {
    const reg = asegurarRegistro(clave);
    const qty = datos.cantidad ?? 0;
    if (tipo === "compras") {
      reg.compras += qty;
      if (datos.codigo) {
        reg.codigoCompras = datos.codigo;
      }
      if (datos.producto) {
        reg.productoCompras = datos.producto;
      }
    } else {
      reg.ventas += qty;
      if (datos.codigo) {
        reg.codigoVentas = datos.codigo;
      }
      if (datos.producto) {
        reg.productoVentas = datos.producto;
      }
    }
  }

  function aplicarStockActual(clave, datos) {
    const reg = asegurarRegistro(clave);
    reg.stockActual = datos.cantidad ?? 0;
    if (datos.codigo) {
      reg.codigoActual = datos.codigo;
    }
    if (datos.producto) {
      reg.productoActual = datos.producto;
    }
    reg.categoria = datos.categoria || reg.categoria;
    reg.marca = datos.marca || reg.marca;
    reg.unidadMedida = datos.unidadMedida || reg.unidadMedida;
    reg.almacen = datos.almacen || reg.almacen;
  }

  for (const [, datos] of mapaAnterior) {
    const clave = resolverClaveBase(datos.codigo, datos.producto);
    if (clave) {
      aplicarAnterior(clave, datos);
    }
  }

  for (const [, datos] of mapaStockActual) {
    const clave = resolverClaveBase(datos.codigo, datos.producto);
    if (clave) {
      aplicarStockActual(clave, datos);
    }
  }

  for (const [, datos] of mapaCompras) {
    const clave = resolverClaveMovimiento(datos.codigo, datos.producto);
    if (clave) {
      aplicarMovimiento(clave, datos, "compras");
    }
  }

  for (const [, datos] of mapaVentas) {
    const clave = resolverClaveMovimiento(datos.codigo, datos.producto);
    if (clave) {
      aplicarMovimiento(clave, datos, "ventas");
    }
  }

  return registros;
}

function registroAFilaReconciliacion(reg) {
  const stockEsperado = reg.stockAnterior + reg.compras - reg.ventas;
  const diferencia = reg.stockActual - stockEsperado;

  const codigo =
    reg.codigoActual ||
    reg.codigoAnterior ||
    reg.codigoCompras ||
    reg.codigoVentas ||
    "";

  const producto =
    reg.productoActual ||
    reg.productoAnterior ||
    reg.productoCompras ||
    reg.productoVentas ||
    "";

  return {
    clave: reg.clave,
    claveProducto: reg.clave,
    codigoCatalogo: reg.codigoAnterior || reg.codigoCompras || reg.codigoVentas || "",
    codigoSistema: reg.codigoActual,
    codigo,
    producto,
    categoria: reg.categoria,
    marca: reg.marca,
    unidadMedida: reg.unidadMedida,
    almacen: reg.almacen,
    stockAnterior: reg.stockAnterior,
    stockBase: reg.stockAnterior,
    compras: reg.compras,
    ventas: reg.ventas,
    stockEsperado,
    stockActual: reg.stockActual,
    diferencia
  };
}

module.exports = {
  construirRegistrosReconciliacion,
  registroAFilaReconciliacion
};
