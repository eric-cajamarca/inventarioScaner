/**
 * Exporta un .xlsx a otro archivo conservando fórmulas (cellFormula).
 * Detecta archivos que no son OOXML estándar (p. ej. cifrado tipo MSMAMARPCRYPT).
 *
 * Uso:
 *   node scripts/excel-exportar-limpio.js "<entrada.xlsx>" "<salida.xlsx>"
 *
 * Ejemplo:
 *   node scripts/excel-exportar-limpio.js "data/NEGATIVOS VERIFICADOS.xlsx" "data/NEGATIVOS_EXPORT_LIMPIO.xlsx"
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function detectarFormato(buf) {
  if (buf.length < 16) {
    return { ok: false, motivo: 'Archivo demasiado pequeño' };
  }
  // OOXML sin cifrado: ZIP local file header
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return { ok: true, tipo: 'ooxml_plano' };
  }
  const cab = buf.subarray(0, 64).toString('binary');
  if (cab.includes('MSMAMARPCRYPT') || cab.includes('EncryptionInfo')) {
    return {
      ok: false,
      tipo: 'cifrado_ooxml',
      motivo:
        'Este archivo está cifrado (Office: contenedor MSMAMARPCRYPT / AES). ' +
        'No es un ZIP OOXML abierto: Excel muestra contraseña o permisos corporativos. ' +
        'Ábrelo en Excel con la contraseña o la cuenta correcta y usa Archivo > Información > ' +
        "Proteger libro > Cifrar con contraseña (quitar) o 'Guardar como' sin restricciones.",
    };
  }
  // OLE clásico (.xls cifrado u OLE)
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) {
    return {
      ok: false,
      tipo: 'ole',
      motivo:
        'Formato OLE (.xls / contenedor antiguo). Si está cifrado, hace falta la contraseña. ' +
        'Prueba abrir en Excel y guardar como .xlsx sin cifrado.',
    };
  }
  return {
    ok: false,
    tipo: 'desconocido',
    motivo:
      'No se reconoce como .xlsx estándar (no empieza por PK). ' +
      'Puede estar dañado o usar un tipo de protección no soportado aquí.',
  };
}

function exportarOOXML(entradaAbs, salidaAbs) {
  const wb = XLSX.readFile(entradaAbs, {
    type: 'file',
    cellFormula: true,
    cellDates: true,
    dense: false,
  });
  XLSX.writeFile(wb, salidaAbs, {
    bookType: 'xlsx',
    compression: true,
  });
  return wb;
}

function main() {
  const entrada = process.argv[2];
  const salida = process.argv[3];
  if (!entrada || !salida) {
    console.error(
      'Uso: node scripts/excel-exportar-limpio.js "<entrada.xlsx>" "<salida.xlsx>"',
    );
    process.exit(1);
  }

  const entradaAbs = path.isAbsolute(entrada) ? entrada : path.join(process.cwd(), entrada);
  const salidaAbs = path.isAbsolute(salida) ? salida : path.join(process.cwd(), salida);

  if (!fs.existsSync(entradaAbs)) {
    console.error('No existe el archivo de entrada:', entradaAbs);
    process.exit(1);
  }

  const buf = fs.readFileSync(entradaAbs);
  const det = detectarFormato(buf);
  if (!det.ok) {
    console.error('[excel-exportar-limpio]', det.motivo);
    console.error('Tipo detectado:', det.tipo);
    process.exit(2);
  }

  const wb = exportarOOXML(entradaAbs, salidaAbs);
  let formulas = 0;
  for (const name of wb.SheetNames) {
    const sh = wb.Sheets[name];
    if (!sh) continue;
    for (const k of Object.keys(sh)) {
      if (k[0] === '!') continue;
      if (sh[k] && sh[k].f) formulas++;
    }
  }
  console.log('Exportado OK:', salidaAbs);
  console.log('Hojas:', wb.SheetNames.length, '| Celdas con fórmula:', formulas);
}

main();
