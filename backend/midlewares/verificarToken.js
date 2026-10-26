const authService = require("../services/auth.service");

function extraerToken(req) {
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return "";
}

function verificarToken(req, _res, next) {
  try {
    const sesion = authService.leerSesion(extraerToken(req));
    req.user = { usuario: sesion.usuario };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = verificarToken;
