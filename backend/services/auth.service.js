const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const TOKEN_EXPIRA = process.env.JWT_EXPIRES_IN || "12h";

function obtenerJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    const error = new Error(
      "Falta JWT_SECRET. Defínelo en .env (local) o en las variables de entorno de Render."
    );
    error.statusCode = 500;
    throw error;
  }
  return secret;
}

function compararPassword(guardada, ingresada) {
  const a = Buffer.from(String(guardada), "utf8");
  const b = Buffer.from(String(ingresada), "utf8");
  const len = Math.max(a.length, b.length, 1);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);
  return a.length === b.length && crypto.timingSafeEqual(pa, pb);
}

function listarUsuariosConfigurados() {
  const usuarios = [];
  const json = String(process.env.AUTH_USERS_JSON || "").trim();
  if (json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      console.error("AUTH_USERS_JSON inválido:", error);
      const err = new Error("AUTH_USERS_JSON no es un JSON válido.");
      err.statusCode = 500;
      throw err;
    }
    if (!Array.isArray(parsed)) {
      const err = new Error("AUTH_USERS_JSON debe ser un arreglo de usuarios.");
      err.statusCode = 500;
      throw err;
    }
    for (const item of parsed) {
      const usuario = String(item?.usuario || "").trim();
      const password = String(item?.password || "");
      if (usuario && password) {
        usuarios.push({ usuario, password });
      }
    }
  }

  const usuario = String(process.env.AUTH_USER || "").trim();
  const password = String(process.env.AUTH_PASSWORD || "");
  if (usuario && password) {
    const yaExiste = usuarios.some((u) => u.usuario === usuario);
    if (!yaExiste) {
      usuarios.push({ usuario, password });
    }
  }

  return usuarios;
}

function iniciarSesion(usuario, password) {
  const user = String(usuario || "").trim();
  const pass = String(password || "");
  if (!user || !pass) {
    const error = new Error("Usuario y contraseña son obligatorios.");
    error.statusCode = 400;
    throw error;
  }

  const usuarios = listarUsuariosConfigurados();
  if (usuarios.length === 0) {
    const error = new Error(
      "El login no está configurado. Define AUTH_USER y AUTH_PASSWORD."
    );
    error.statusCode = 500;
    throw error;
  }

  const cuenta = usuarios.find((u) => u.usuario === user);
  if (!cuenta || !compararPassword(cuenta.password, pass)) {
    const error = new Error("Usuario o contraseña incorrectos.");
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign({ usuario: cuenta.usuario }, obtenerJwtSecret(), {
    expiresIn: TOKEN_EXPIRA
  });

  return {
    token,
    usuario: cuenta.usuario,
    expiraEn: TOKEN_EXPIRA
  };
}

function leerSesion(token) {
  if (!token) {
    const error = new Error("Debes iniciar sesión.");
    error.statusCode = 401;
    throw error;
  }
  try {
    const payload = jwt.verify(token, obtenerJwtSecret());
    const usuario = String(payload.usuario || "").trim();
    if (!usuario) {
      const error = new Error("Sesión inválida. Inicia sesión de nuevo.");
      error.statusCode = 401;
      throw error;
    }
    return { usuario };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    const err = new Error("Sesión inválida o vencida. Inicia sesión de nuevo.");
    err.statusCode = 401;
    throw err;
  }
}

module.exports = {
  iniciarSesion,
  leerSesion,
  obtenerJwtSecret
};
