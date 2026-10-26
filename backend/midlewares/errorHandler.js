function errorHandler(error, _req, res, _next) {
  console.error("Error en request:", error);
  const status = Number(error.statusCode) || 400;
  res.status(status).json({
    ok: false,
    message: error.message || "Error inesperado"
  });
}

module.exports = errorHandler;
