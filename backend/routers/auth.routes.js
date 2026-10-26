const express = require("express");
const authController = require("../controllers/auth.controller");
const verificarToken = require("../midlewares/verificarToken");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", verificarToken, authController.me);

module.exports = router;
