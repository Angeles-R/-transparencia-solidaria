
const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// CONSULTAR TODOS LOS BENEFICIARIOS
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT *
      FROM beneficiarios
      ORDER BY id DESC
    `);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar los beneficiarios"
    });
  }
});

// CONSULTAR UN BENEFICIARIO POR ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de beneficiario invalido"
      });
    }

    const resultado = await pool.query(
      "SELECT * FROM beneficiarios WHERE id = $1",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Beneficiario no encontrado"
      });
    }

    res.json(resultado.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar el beneficiario"
    });
  }
});

// REGISTRAR UN BENEFICIARIO
router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      direccion
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        mensaje: "El nombre es obligatorio"
      });
    }

    const resultado = await pool.query(
      `INSERT INTO beneficiarios
       (nombre, telefono, direccion)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        nombre.trim(),
        telefono?.trim() || null,
        direccion?.trim() || null
      ]
    );

    res.status(201).json({
      mensaje: "Beneficiario registrado correctamente",
      beneficiario: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al registrar el beneficiario"
    });
  }
});


// MODIFICAR UN BENEFICIARIO
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, direccion } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de beneficiario invalido"
      });
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        mensaje: "El nombre es obligatorio"
      });
    }

    const resultado = await pool.query(
      `UPDATE beneficiarios
       SET nombre = $1,
           telefono = $2,
           direccion = $3,
           actualizado_en = NOW()
       WHERE id = $4
         AND activo = TRUE
       RETURNING *`,
      [
        nombre.trim(),
        telefono?.trim() || null,
        direccion?.trim() || null,
        id
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Beneficiario no encontrado o inactivo"
      });
    }

    res.json({
      mensaje: "Beneficiario actualizado correctamente",
      beneficiario: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al modificar el beneficiario"
    });
  }
});


// DESACTIVAR UN BENEFICIARIO
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de beneficiario invalido"
      });
    }

    const resultado = await pool.query(
      `UPDATE beneficiarios
       SET activo = FALSE,
           actualizado_en = NOW()
       WHERE id = $1
         AND activo = TRUE
       RETURNING *`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Beneficiario no encontrado o ya inactivo"
      });
    }

    res.json({
      mensaje: "Beneficiario desactivado correctamente",
      beneficiario: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al desactivar el beneficiario"
    });
  }
});

module.exports = router;
