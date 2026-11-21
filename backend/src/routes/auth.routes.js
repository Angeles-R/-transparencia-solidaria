
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Iniciar sesión
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        mensaje: "Correo y contraseña son obligatorios",
      });
    }

    const resultado = await pool.query(
      `SELECT id, nombre, email, password_hash, rol, activo
       FROM usuarios
       WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        mensaje: "Correo o contraseña incorrectos",
      });
    }

    const usuario = resultado.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: "Esta cuenta se encuentra desactivada",
      });
    }

    const passwordValida = await bcrypt.compare(
      password,
      usuario.password_hash
    );

    if (!passwordValida) {
      return res.status(401).json({
        mensaje: "Correo o contraseña incorrectos",
      });
    }

    const token = jwt.sign(
      {
        sub: usuario.id.toString(),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      }
    );

    return res.json({
      mensaje: "Inicio de sesión correcto",
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error("Error en login:", error.message);

    return res.status(500).json({
      mensaje: "Error interno al iniciar sesión",
    });
  }
});

// Consultar usuario autenticado
router.get("/me", authMiddleware, (req, res) => {
  res.json({
    usuario: req.usuario,
  });
});

module.exports = router;
