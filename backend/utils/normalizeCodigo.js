/**
 * Normaliza códigos para comparación: ignora espacios, unifica guiones Unicode
 * y mayúsculas. Así "CLT - 45", "CLT-45" y "clt–45" coinciden.
 */
function normalizarCodigoParaComparar(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\u00A0\uFEFF]+/g, "")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-");
}

module.exports = {
  normalizarCodigoParaComparar
};
