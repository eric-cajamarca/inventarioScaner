/**
 * Extrae posibles códigos de producto desde texto OCR (etiquetas, cajas).
 * Prioriza CLT-45, CL0574 y EAN; ignora unidades y palabras de la etiqueta.
 */
const PALABRAS_IGNORAR = new Set([
  "1EA",
  "2EA",
  "3EA",
  "EA",
  "UND",
  "UN",
  "PCS",
  "PC",
  "SET",
  "KIT",
  "MADE",
  "KOREA",
  "CHINA",
  "JAPAN",
  "TAIWAN",
  "STABILIZER",
  "STABILISER",
  "LINK",
  "LINKING",
  "LINKAGE",
  "IN",
  "THE",
  "AND"
]);

function esCandidatoValido(valor) {
  const v = String(valor || "").trim().toUpperCase();
  if (v.length < 4 || v.length > 32) {
    return false;
  }
  if (PALABRAS_IGNORAR.has(v)) {
    return false;
  }
  if (/^(MADE|IN|KOREA|CHINA|JAPAN)/.test(v)) {
    return false;
  }
  if (/^\d{1,6}$/.test(v)) {
    return false;
  }
  return true;
}

function extraerCandidatosDesdeTexto(texto) {
  const raw = String(texto || "");
  const t = raw.replace(/\s+/g, " ").toUpperCase();
  const candidatos = new Set();

  const agregar = (s) => {
    const v = String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    if (esCandidatoValido(v)) {
      candidatos.add(v);
    }
  };

  let m;
  const reGuion = /\b([A-Z]{1,6}-[A-Z0-9]{2,12})\b/g;
  while ((m = reGuion.exec(t)) !== null) {
    agregar(m[1]);
  }

  const rePipePar = /([A-Z0-9-]{3,24})\s*\|\s*([A-Z0-9-]{3,24})/g;
  while ((m = rePipePar.exec(t)) !== null) {
    agregar(m[1]);
    agregar(m[2]);
  }

  const reAlfanum = /(?:^|[^A-Z0-9])(\d{1,3}[A-Z][A-Z0-9]{4,14})(?=[^A-Z0-9]|$)/g;
  while ((m = reAlfanum.exec(t)) !== null) {
    agregar(m[1]);
  }

  const reEmbebido = /\d{2}[A-Z][A-Z0-9]{4,14}/g;
  while ((m = reEmbebido.exec(t)) !== null) {
    agregar(m[0]);
  }

  const reCompacto = /\b([A-Z]{2,5}\d{3,8}[A-Z0-9]{0,6})\b/g;
  while ((m = reCompacto.exec(t)) !== null) {
    agregar(m[1]);
  }

  const reEan = /\b(\d{8,14})\b/g;
  while ((m = reEan.exec(t)) !== null) {
    agregar(m[1]);
  }

  const reEanImpreso = /\b(\d)\s+(\d{6,7})\s+(\d{5,6})\b/g;
  while ((m = reEanImpreso.exec(t)) !== null) {
    agregar(`${m[1]}${m[2]}${m[3]}`);
  }

  const reNumericoLargo = /\b(\d{7,16})\b/g;
  while ((m = reNumericoLargo.exec(t)) !== null) {
    agregar(m[1]);
  }

  const lista = [...candidatos].filter((c) => {
    if (!/^\d+$/.test(c)) {
      return true;
    }
    return ![...candidatos].some(
      (otro) => otro !== c && /^\d+$/.test(otro) && otro.includes(c)
    );
  });

  return lista.sort((a, b) => {
    const pa = prioridadCandidato(a);
    const pb = prioridadCandidato(b);
    if (pa !== pb) {
      return pa - pb;
    }
    return b.length - a.length;
  });
}

function prioridadCandidato(codigo) {
  if (/^[A-Z]{1,6}-[A-Z0-9]{2,12}$/.test(codigo)) {
    return 1;
  }
  if (/^[A-Z]{2,5}\d{3,8}[A-Z0-9]*$/.test(codigo)) {
    return 2;
  }
  if (/^\d{8,14}$/.test(codigo)) {
    return 3;
  }
  if (/^\d{7,}$/.test(codigo)) {
    return 4;
  }
  return 5;
}

function extraerCandidatosAmpliados(texto) {
  const textoLimpio = String(texto || "").trim();
  const candidatos = extraerCandidatosDesdeTexto(textoLimpio);
  const vistos = new Set(candidatos.map((c) => c.toUpperCase()));
  const agregar = (valor) => {
    const v = String(valor || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    if (!esCandidatoValido(v) || vistos.has(v)) {
      return;
    }
    vistos.add(v);
    candidatos.push(v);
  };

  for (const linea of textoLimpio.split(/\r?\n/)) {
    agregar(linea);
    for (const token of String(linea).split(/[\s,;:|/]+/)) {
      agregar(token);
    }
  }

  return candidatos.sort((a, b) => {
    const pa = prioridadCandidato(a);
    const pb = prioridadCandidato(b);
    if (pa !== pb) {
      return pa - pb;
    }
    return b.length - a.length;
  });
}

module.exports = {
  extraerCandidatosDesdeTexto,
  extraerCandidatosAmpliados
};
