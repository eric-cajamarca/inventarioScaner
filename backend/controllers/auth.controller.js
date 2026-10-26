const authService = require("../services/auth.service");

function extraerToken(req) {
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return "";
}

async function login(req, res, next) {
  try {
    const resultado = authService.iniciarSesion(req.body?.usuario, req.body?.password);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const sesion = authService.leerSesion(extraerToken(req));
    res.json({ ok: true, usuario: sesion.usuario });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  me
};
