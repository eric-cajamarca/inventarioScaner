const Fuse = require("fuse.js");

let fuseInstancia = null;
let fuseProductosRef = null;

const FUSE_OPTIONS = {
  includeScore: true,
  shouldSort: true,
  threshold: 0.45,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: "codigo", weight: 0.35 },
    { name: "producto", weight: 0.4 },
    { name: "marca", weight: 0.12 },
    { name: "categoria", weight: 0.08 },
    { name: "almacen", weight: 0.03 },
    { name: "unidadMedida", weight: 0.02 }
  ]
};

function invalidateFuseCache() {
  fuseInstancia = null;
  fuseProductosRef = null;
}

function buscarCoincidenciasAproximadas(productos, termino, limite = 30) {
  if (!fuseInstancia || fuseProductosRef !== productos) {
    fuseProductosRef = productos;
    fuseInstancia = new Fuse(productos, FUSE_OPTIONS);
  }
  return fuseInstancia.search(termino, { limit: limite }).map((item) => item.item);
}

module.exports = {
  buscarCoincidenciasAproximadas,
  invalidateFuseCache
};
