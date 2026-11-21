
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const permitirRoles = require("../middlewares/roles.middleware");

const router = express.Router();

// Todas las operaciones de este módulo son exclusivas del administrador.
router.use(permitirRoles("admin"));

// CONSULTAR TODOS LOS USUARIOS
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, rol, activo, creado_en, actualizado_en
       FROM usuarios
       ORDER BY id DESC`
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar usuarios:", error.message);
    res.status(500).json({ mensaje: "Error al consultar usuarios" });
  }
});

// CONSULTAR UN USUARIO
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ mensaje: "ID inválido" });
    }

    const resultado = await pool.query(
      `SELECT id, nombre, email, rol, activo, creado_en, actualizado_en
       FROM usuarios
       WHERE id = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Error al consultar usuario:", error.message);
    res.status(500).json({ mensaje: "Error al consultar usuario" });
  }
});

// REGISTRAR USUARIO
router.post("/", async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({
        mensaje: "Todos los campos son obligatorios"
      });
    }

    if (!["admin", "operador"].includes(rol)) {
      return res.status(400).json({ mensaje: "Rol inválido" });
    }

    if (password.length < 12) {
      return res.status(400).json({
        mensaje: "La contraseña debe tener al menos 12 caracteres"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, rol, activo, creado_en`,
      [nombre.trim(), email.trim().toLowerCase(), passwordHash, rol]
    );

    res.status(201).json({
      mensaje: "Usuario registrado correctamente",
      usuario: resultado.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "El correo electrónico ya está registrado"
      });
    }

    console.error("Error al registrar usuario:", error.message);
    res.status(500).json({ mensaje: "Error al registrar usuario" });
  }
});

// ACTUALIZAR USUARIO
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, password } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ mensaje: "ID inválido" });
    }

    if (!nombre || !email || !rol) {
      return res.status(400).json({
        mensaje: "Nombre, correo y rol son obligatorios"
      });
    }

    if (!["admin", "operador"].includes(rol)) {
      return res.status(400).json({ mensaje: "Rol inválido" });
    }

    if (password && password.length < 12) {
      return res.status(400).json({
        mensaje: "La contraseña debe tener al menos 12 caracteres"
      });
    }

    const actual = await pool.query(
      "SELECT id FROM usuarios WHERE id = $1 AND activo = TRUE",
      [id]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado o inactivo" });
    }

    // Evitar que el administrador se quite a sí mismo su acceso administrativo.
    if (String(req.usuario.id) === id && rol !== "admin") {
      return res.status(400).json({
        mensaje: "No puedes quitarte tu propio rol de administrador"
      });
    }

    let resultado;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);

      resultado = await pool.query(
        `UPDATE usuarios
         SET nombre = $1, email = $2, rol = $3,
             password_hash = $4, actualizado_en = NOW()
         WHERE id = $5
         RETURNING id, nombre, email, rol, activo, actualizado_en`,
        [nombre.trim(), email.trim().toLowerCase(), rol, passwordHash, id]
      );
    } else {
      resultado = await pool.query(
        `UPDATE usuarios
         SET nombre = $1, email = $2, rol = $3, actualizado_en = NOW()
         WHERE id = $4
         RETURNING id, nombre, email, rol, activo, actualizado_en`,
        [nombre.trim(), email.trim().toLowerCase(), rol, id]
      );
    }

    res.json({
      mensaje: "Usuario actualizado correctamente",
      usuario: resultado.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "El correo electrónico ya está registrado"
      });
    }

    console.error("Error al actualizar usuario:", error.message);
    res.status(500).json({ mensaje: "Error al actualizar usuario" });
  }
});

// DESACTIVAR USUARIO
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ mensaje: "ID inválido" });
    }

    if (String(req.usuario.id) === id) {
      return res.status(400).json({
        mensaje: "No puedes desactivar tu propia cuenta"
      });
    }

    const resultado = await pool.query(
      `UPDATE usuarios
       SET activo = FALSE, actualizado_en = NOW()
       WHERE id = $1 AND activo = TRUE
       RETURNING id, nombre, email, rol, activo`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado o ya está inactivo"
      });
    }

    res.json({
      mensaje: "Usuario desactivado correctamente",
      usuario: resultado.rows[0]
    });
  } catch (error) {
    console.error("Error al desactivar usuario:", error.message);
    res.status(500).json({ mensaje: "Error al desactivar usuario" });
  }
});

module.exports = router;
