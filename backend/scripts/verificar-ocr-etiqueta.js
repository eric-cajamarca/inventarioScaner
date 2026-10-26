const assert = require("assert");
const { extraerCandidatosDesdeTexto } = require("../utils/ocrExtract");

const textoEtiqueta = `
CL0574|CLT-45
1EA
8 8061999 133299
MADE IN KOREA
STABILIZER LINK
2604166
1450033
`;

const candidatos = extraerCandidatosDesdeTexto(textoEtiqueta);
assert.ok(candidatos.includes("CLT-45"), `falta CLT-45: ${candidatos}`);
assert.ok(candidatos.includes("CL0574"), `falta CL0574: ${candidatos}`);
assert.ok(
  candidatos.includes("88061999133299") || candidatos.includes("8061999133299"),
  `falta EAN: ${candidatos}`
);
assert.ok(!candidatos.includes("1EA"), "no debe incluir 1EA");
assert.ok(!candidatos.includes("KOREA"), "no debe incluir KOREA");
assert.ok(!candidatos.includes("STABILIZER"), "no debe incluir STABILIZER");

process.stdout.write(`Candidatos: ${candidatos.join(", ")}\n`);
process.stdout.write("OCR etiqueta: ok\n");
