
const express = require("express");
const router = express.Router();

const pool = require("../config/database");

// CONSULTAR TODOS LOS DONANTES
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM donantes
       ORDER BY id DESC`
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      mensaje: "Error al consultar donantes",
    });
  }
});


 // CONSULTAR UN DONANTE POR ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de donante inválido",
      });
    }

    const resultado = await pool.query(
      "SELECT * FROM donantes WHERE id = $1",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Donante no encontrado",
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar el donante",
    });
  }
});

// REGISTRAR UN DONANTE
router.post("/", async (req, res) => {
  try {
    const { nombre, telefono, email, tipo } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        mensaje: "El nombre del donante es obligatorio",
      });
    }

    const resultado = await pool.query(
      `INSERT INTO donantes (nombre, telefono, email, tipo)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        nombre.trim(),
        telefono || null,
        email || null,
        tipo || "persona",
      ]
    );

    res.status(201).json({
      mensaje: "Donante registrado correctamente",
      donante: resultado.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al registrar el donante",
    });
  }
});


 // MODIFICAR UN DONANTE
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, email, tipo } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de donante inválido",
      });
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        mensaje: "El nombre es obligatorio",
      });
    }

    if (!["persona", "empresa", "organizacion"].includes(tipo)) {
      return res.status(400).json({
        mensaje: "Tipo de donante inválido",
      });
    }

    const resultado = await pool.query(
      `UPDATE donantes
       SET nombre = $1,
           telefono = $2,
           email = $3,
           tipo = $4,
           actualizado_en = NOW()
       WHERE id = $5 AND activo = TRUE
       RETURNING *`,
      [
        nombre.trim(),
        telefono || null,
        email || null,
        tipo,
        id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Donante no encontrado o inactivo",
      });
    }

    res.json({
      mensaje: "Donante actualizado correctamente",
      donante: resultado.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al actualizar el donante",
    });
  }
});


 // ELIMINAR (DESACTIVAR) UN DONANTE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de donante inválido",
      });
    }

    const resultado = await pool.query(
      `UPDATE donantes
       SET activo = FALSE,
           actualizado_en = NOW()
       WHERE id = $1 AND activo = TRUE
       RETURNING *`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Donante no encontrado o ya está inactivo",
      });
    }

    res.json({
      mensaje: "Donante desactivado correctamente",
      donante: resultado.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al desactivar el donante",
    });
  }
});

module.exports = router;
