function errorHandler(error, _req, res, _next) {
  console.error("Error en request:", error);
  res.status(400).json({
    ok: false,
    message: error.message || "Error inesperado"
  });
}

module.exports = errorHandler;
