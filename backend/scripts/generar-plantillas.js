/**
 * Genera plantillas Excel en backend/data/plantillas/
 *
 * Uso: node scripts/generar-plantillas.js
 */

const { generarTodasLasPlantillas } = require("../utils/plantillasInventario");

const rutas = generarTodasLasPlantillas();
for (const [clave, ruta] of Object.entries(rutas)) {
  process.stdout.write(`Plantilla ${clave}: ${ruta}\n`);
}
