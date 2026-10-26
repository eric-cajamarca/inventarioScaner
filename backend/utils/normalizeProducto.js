/**
 * Pares típicos UTF-8 leídos como Latin-1 (tildes, eñe, diéresis).
 */
const PARES_MOJIBAKE_LATIN1 = [
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã±", "ñ"],
  ["Ã¼", "ü"],
  ["Ã\x81", "Á"],
  ["Ã‰", "É"],
  ["Ã\x8D", "Í"],
  ["Ã“", "Ó"],
  ["Ã\x9A", "Ú"],
  ["Ã\x91", "Ñ"],
  ["Ã\x89", "É"],
  ["Ã\x93", "Ó"],
  ["Ã\xAD", "í"],
  ["Ã\xA1", "á"],
  ["Ã\xB3", "ó"],
  ["Ã\xBA", "ú"],
  ["Ã\xB1", "ñ"]
];

/**
 * Excel a veces sustituye el 2.º byte UTF-8 por comilla tipográfica.
 */
function repararComillasTipograficas(texto) {
  let s = texto;

  // PEQUEÃ'A → PEQUEÑA
  s = s.replace(/(?<=PEQUE)Ã[\u2018\u2019\u0091\u00B1'`´](?=A)/gi, "Ñ");
  s = s.replace(/(?<=QUE)Ã[\u2018\u2019\u0091\u00B1'`´](?=A)/gi, "Ñ");

  // ELÃ'CTRICO / ELÃ'TRICO → ELÉCTRICO
  s = s.replace(/Ã[\u2018\u2019\u0091'`´](?=CTRIC)/gi, "É");
  s = s.replace(/Ã[\u2018\u2019\u0091'`´](?=TRIC)/gi, "É");
  s = s.replace(
    /(?<=[AEILOUQ])Ã[\u2018\u2019\u0091'`´](?=[B-DF-HJ-NP-TV-Z])/gi,
    "É"
  );

  // Resto de Ã + comilla tipográfica (tildes frecuentes en export ERP)
  s = s.replace(/Ã[\u2018\u2019\u0091\u00B1'`´]/g, "É");

  return s;
}

/**
 * Repara texto UTF-8 mal interpretado como Latin-1 o sustituido por Excel.
 */
function corregirEncodingMojibake(texto) {
  let s = String(texto ?? "").trim();
  if (!s) {
    return s;
  }

  s = repararComillasTipograficas(s);

  for (const [mal, bien] of PARES_MOJIBAKE_LATIN1) {
    if (s.includes(mal)) {
      s = s.split(mal).join(bien);
    }
  }

  if (/[ÃÂ]/.test(s)) {
    try {
      const reparado = Buffer.from(s, "latin1").toString("utf8");
      if (reparado && !reparado.includes("\uFFFD") && reparado !== s) {
        s = reparado;
      }
    } catch (_) {
      /* ignorar */
    }
  }

  return s;
}

/**
 * Limpia nombre de producto antes de comparar o guardar.
 */
function prepararNombreProducto(valor) {
  return corregirEncodingMojibake(String(valor || "").trim());
}

/**
 * Normaliza nombres de producto para emparejar entre archivos con códigos distintos.
 */
function normalizarProductoParaComparar(valor) {
  return prepararNombreProducto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\u00A0\uFEFF]+/g, " ")
    .replace(/\s+/g, " ");
}

module.exports = {
  corregirEncodingMojibake,
  prepararNombreProducto,
  normalizarProductoParaComparar
};
