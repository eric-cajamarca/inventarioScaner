/**
 * Extrae posibles códigos de producto desde texto OCR (etiquetas, cajas).
 * Cubre formatos tipo CLT-45, CL0574|CLT-45 y referencias alfanuméricas 38BWD15A.
 */
function extraerCandidatosDesdeTexto(texto) {
  const raw = String(texto || "");
  const t = raw.replace(/\s+/g, " ").toUpperCase();
  const candidatos = new Set();

  const agregar = (s) => {
    const v = String(s || "").trim();
    if (v.length >= 3 && v.length <= 32) {
      candidatos.add(v);
    }
  };

  let m;
  const reGuion = /\b([A-Z]{1,6}-[A-Z0-9]{2,12})\b/g;
  while ((m = reGuion.exec(t)) !== null) {
    agregar(m[1]);
  }

  const rePipe = /\|\s*([A-Z0-9-]{3,24})/g;
  while ((m = rePipe.exec(t)) !== null) {
    agregar(m[1].replace(/\s+/g, ""));
  }

  const reAlfanum = /(?:^|[^A-Z0-9])(\d{1,3}[A-Z][A-Z0-9]{4,14})(?=[^A-Z0-9]|$)/g;
  while ((m = reAlfanum.exec(t)) !== null) {
    agregar(m[1]);
  }

  const reEmbebido = /\d{2}[A-Z][A-Z0-9]{4,14}/g;
  while ((m = reEmbebido.exec(t)) !== null) {
    agregar(m[0]);
  }

  const reCompacto = /\b([A-Z]{2,4}\d{2,6}[A-Z]?\d{0,4})\b/g;
  while ((m = reCompacto.exec(t)) !== null) {
    if (m[1].length >= 6) {
      agregar(m[1]);
    }
  }

  return [...candidatos].sort((a, b) => b.length - a.length);
}

module.exports = {
  extraerCandidatosDesdeTexto
};
