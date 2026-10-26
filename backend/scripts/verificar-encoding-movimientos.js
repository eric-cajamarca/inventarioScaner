/**
 * Verifica encoding (tildes, ñ) y que compras sumen al stock esperado.
 * Uso: node scripts/verificar-encoding-movimientos.js
 */
const XLSX = require("xlsx");
const repo = require("../repositories/reconciliacion.repository");
const { prepararNombreProducto, normalizarProductoParaComparar } = require("../utils/normalizeProducto");
const { claveEmparejamientoInventario } = require("../utils/claveEmparejamiento");

function buf(aoa) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "H");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function fallar(mensaje) {
  console.error("FALLO:", mensaje);
  process.exit(1);
}

const NOMBRE_CORRECTO = "BOCINA DE TRAPECIO HILUX PEQUEÑA 98 CTR";
const NOMBRE_MOJIBAKE_N = "BOCINA DE TRAPECIO HILUX PEQUE\u00C3\u2018A 98 CTR";

const claveEsperada = normalizarProductoParaComparar(NOMBRE_CORRECTO);
if (prepararNombreProducto(NOMBRE_MOJIBAKE_N) !== NOMBRE_CORRECTO) {
  fallar("No reparó PEQUEÃ'A → PEQUEÑA");
}

const tildes = [
  ["Categoría", Buffer.from("Categoría", "utf8").toString("latin1")],
  ["Eléctrico", "EL\u00C3\u2018CTRICO"],
  ["Diámetro", Buffer.from("Diámetro", "utf8").toString("latin1")],
  ["Información", Buffer.from("Información", "utf8").toString("latin1")]
];

for (const [ok, malo] of tildes) {
  const prep = prepararNombreProducto(malo);
  if (normalizarProductoParaComparar(prep) !== normalizarProductoParaComparar(ok)) {
    fallar(`Tilde: «${malo}» no empareja con «${ok}» (obtuvo «${prep}»)`);
  }
  console.log(`OK tilde: ${ok}`);
}

const fila = [["Código", "Producto", "Cantidad"], ["ERP-1118", NOMBRE_MOJIBAKE_N, 5]];
for (const { etiqueta, leer } of [
  { etiqueta: "compras", leer: (b) => repo.leerMapaMovimientos(b, "compras") },
  { etiqueta: "ventas", leer: (b) => repo.leerMapaMovimientos(b, "ventas") },
  { etiqueta: "stock anterior", leer: (b) => repo.leerMapaStockAnterior(b) }
]) {
  const { mapa } = leer(buf(fila));
  const clave = claveEmparejamientoInventario("ERP-1118", NOMBRE_CORRECTO);
  const hit = mapa.get(clave);
  if (!hit) {
    fallar(`${etiqueta}: no leyó fila por código ERP-1118`);
  }
  const cantidad = hit.cantidad ?? hit.stockAnterior;
  if (cantidad !== 5) {
    fallar(`${etiqueta}: cantidad esperada 5, obtuvo ${cantidad}`);
  }
  if (prepararNombreProducto(hit.producto) !== NOMBRE_CORRECTO) {
    fallar(`${etiqueta}: nombre no reparado (${hit.producto})`);
  }
  console.log(`OK ${etiqueta}: código, nombre y cantidad`);
}

const anterior = buf([["Producto", "Cantidad"], [NOMBRE_CORRECTO, 10]]);
const compras = buf([
  ["Reporte compras", "", ""],
  ["", "", ""],
  ["Codigo", "Descripcion", "Unidades"],
  ["999", NOMBRE_MOJIBAKE_N, 3]
]);
const ventas = buf([["Producto", "Cantidad"], [NOMBRE_CORRECTO, 1]]);
const stock = buf([
  ["Codigo", "Producto", "Stock"],
  ["CVT-21", NOMBRE_CORRECTO, 12]
]);

const { mapa: ma } = repo.leerMapaStockAnterior(anterior);
const { mapa: mc } = repo.leerMapaMovimientos(compras, "compras");
const { mapa: mv } = repo.leerMapaMovimientos(ventas, "ventas");
const { mapa: ms } = repo.leerMapaStockActualSistema(stock);

const {
  construirRegistrosReconciliacion,
  registroAFilaReconciliacion
} = require("../utils/reconciliacionIndex");
const regs = construirRegistrosReconciliacion({
  mapaAnterior: ma,
  mapaCompras: mc,
  mapaVentas: mv,
  mapaStockActual: ms
});
const filaRecon = registroAFilaReconciliacion(
  [...regs.values()].find((r) => r.compras === 3 && r.stockAnterior === 10) ||
    [...regs.values()][0]
);

if (filaRecon.compras !== 3) {
  fallar(`Compras no sumaron: esperado 3, obtuvo ${filaRecon.compras}`);
}
if (filaRecon.stockEsperado !== 12) {
  fallar(
    `Stock esperado: 10+3-1=12, obtuvo ${filaRecon.stockEsperado} (ant=${filaRecon.stockAnterior} comp=${filaRecon.compras} ven=${filaRecon.ventas})`
  );
}
if (filaRecon.stockActual !== 12) {
  fallar(`Stock actual ${filaRecon.stockActual} != 12`);
}

console.log("OK compras suman al stock esperado: 10 + 3 - 1 = 12");
console.log("Todas las verificaciones pasaron.");
