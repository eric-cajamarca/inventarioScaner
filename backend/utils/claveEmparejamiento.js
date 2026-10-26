const { normalizarCodigoParaComparar } = require("./normalizeCodigo");
const { normalizarProductoParaComparar } = require("./normalizeProducto");

/**
 * Clave de emparejamiento: código si existe; si no, nombre normalizado.
 * Evita sumar productos distintos (CLT-45 / CLT-46) con la misma descripción.
 */
function claveEmparejamientoInventario(codigo, producto) {
  const codNorm = normalizarCodigoParaComparar(
    codigo !== undefined && codigo !== null ? String(codigo) : ""
  );
  if (codNorm) {
    return codNorm;
  }
  return normalizarProductoParaComparar(producto);
}

module.exports = {
  claveEmparejamientoInventario
};
