const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const PLANTILLAS_DIR = path.join(__dirname, "..", "data", "plantillas");

const ENCABEZADOS_MOVIMIENTO = ["Código", "Producto", "Cantidad"];

const ENCABEZADOS_STOCK_SISTEMA = [
  "Código",
  "Producto",
  "Categoría",
  "Marca",
  "UNIDAD MED",
  "Almacen",
  "Stock",
  "STOCK REAL",
  "Diferencia"
];

const DEFINICIONES = {
  compras: {
    nombreArchivo: "plantilla_compras.xlsx",
    titulo: "Compras del período",
    encabezados: ENCABEZADOS_MOVIMIENTO,
    filasEjemplo: [
      ["CLT-45", "Producto ejemplo A", 10],
      ["YARIS", "Producto ejemplo B", 5]
    ]
  },
  ventas: {
    nombreArchivo: "plantilla_ventas.xlsx",
    titulo: "Ventas del período",
    encabezados: ENCABEZADOS_MOVIMIENTO,
    filasEjemplo: [
      ["CLT-45", "Producto ejemplo A", 3],
      ["YARIS", "Producto ejemplo B", 2]
    ]
  },
  "stock-actual": {
    nombreArchivo: "plantilla_stock_actual.xlsx",
    titulo: "Stock actual del sistema",
    encabezados: ENCABEZADOS_STOCK_SISTEMA,
    filasEjemplo: [
      [
        "CLT-45",
        "Producto ejemplo A",
        "Categoría demo",
        "Marca demo",
        "UN",
        "Almacén principal",
        17,
        "",
        ""
      ],
      [
        "YARIS",
        "Producto ejemplo B",
        "Categoría demo",
        "Marca demo",
        "UN",
        "Almacén principal",
        8,
        "",
        ""
      ]
    ]
  },
  "stock-anterior": {
    nombreArchivo: "plantilla_stock_anterior.xlsx",
    titulo: "Stock anterior inventario",
    encabezados: ENCABEZADOS_MOVIMIENTO,
    filasEjemplo: [
      ["CVT-34", "BOCINA TRAPECIO CTR", 47],
      ["CLT-45", "Producto ejemplo A", 12]
    ]
  }
};

function crearWorkbookPlantilla(def) {
  const encabezados = def.encabezados || ENCABEZADOS_MOVIMIENTO;
  const aoa = [encabezados, ...(def.filasEjemplo || [])];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, def.titulo.slice(0, 31));
  return wb;
}

function asegurarDirectorioPlantillas() {
  if (!fs.existsSync(PLANTILLAS_DIR)) {
    fs.mkdirSync(PLANTILLAS_DIR, { recursive: true });
  }
}

function generarTodasLasPlantillas() {
  asegurarDirectorioPlantillas();
  const rutas = {};
  for (const [clave, def] of Object.entries(DEFINICIONES)) {
    const ruta = path.join(PLANTILLAS_DIR, def.nombreArchivo);
    const wb = crearWorkbookPlantilla(def);
    XLSX.writeFile(wb, ruta, { bookType: "xlsx" });
    rutas[clave] = ruta;
  }
  return rutas;
}

function resolverClavePlantilla(param) {
  const p = String(param || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(DEFINICIONES, p)) {
    return p;
  }
  const alias = {
    compra: "compras",
    compras: "compras",
    venta: "ventas",
    ventas: "ventas",
    stock: "stock-actual",
    stock_actual: "stock-actual",
    "stock-actual": "stock-actual",
    "stock-anterior": "stock-anterior",
    inventario: "stock-anterior",
    "inventario-anterior": "stock-anterior"
  };
  return alias[p] || null;
}

function obtenerRutaPlantilla(claveParam) {
  const clave = resolverClavePlantilla(claveParam);
  if (!clave) {
    return null;
  }
  asegurarDirectorioPlantillas();
  const def = DEFINICIONES[clave];
  const ruta = path.join(PLANTILLAS_DIR, def.nombreArchivo);
  if (!fs.existsSync(ruta)) {
    generarTodasLasPlantillas();
  }
  return { clave, ruta, def };
}

function listarPlantillasDisponibles() {
  asegurarDirectorioPlantillas();
  for (const clave of Object.keys(DEFINICIONES)) {
    const def = DEFINICIONES[clave];
    const ruta = path.join(PLANTILLAS_DIR, def.nombreArchivo);
    if (!fs.existsSync(ruta)) {
      generarTodasLasPlantillas();
      break;
    }
  }
  return Object.entries(DEFINICIONES).map(([clave, def]) => ({
    clave,
    nombreArchivo: def.nombreArchivo,
    titulo: def.titulo,
    columnas: def.encabezados || ENCABEZADOS_MOVIMIENTO
  }));
}

module.exports = {
  PLANTILLAS_DIR,
  DEFINICIONES,
  ENCABEZADOS_MOVIMIENTO,
  ENCABEZADOS_STOCK_SISTEMA,
  generarTodasLasPlantillas,
  obtenerRutaPlantilla,
  listarPlantillasDisponibles,
  resolverClavePlantilla
};
