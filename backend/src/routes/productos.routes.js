
const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// CONSULTAR TODOS LOS PRODUCTOS
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT *
      FROM productos
      ORDER BY id DESC
    `);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar los productos"
    });
  }
});

// CONSULTAR UN PRODUCTO POR ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de producto invalido"
      });
    }

    const resultado = await pool.query(
      "SELECT * FROM productos WHERE id = $1",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado"
      });
    }

    res.json(resultado.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar el producto"
    });
  }
});

// REGISTRAR UN PRODUCTO
router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      categoria,
      unidad_medida
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        mensaje: "El nombre es obligatorio"
      });
    }

    if (!categoria || !categoria.trim()) {
      return res.status(400).json({
        mensaje: "La categoria es obligatoria"
      });
    }

    const resultado = await pool.query(
      `INSERT INTO productos
       (nombre, descripcion, categoria, unidad_medida)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        nombre.trim(),
        descripcion?.trim() || null,
        categoria.trim(),
        unidad_medida?.trim() || "pieza"
      ]
    );

    res.status(201).json({
      mensaje: "Producto registrado correctamente",
      producto: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al registrar el producto"
    });
  }
});


// MODIFICAR UN PRODUCTO
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      categoria,
      unidad_medida
    } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de producto invalido"
      });
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        mensaje: "El nombre es obligatorio"
      });
    }

    if (!categoria || !categoria.trim()) {
      return res.status(400).json({
        mensaje: "La categoria es obligatoria"
      });
    }

    const resultado = await pool.query(
      `UPDATE productos
       SET nombre = $1,
           descripcion = $2,
           categoria = $3,
           unidad_medida = $4,
           actualizado_en = NOW()
       WHERE id = $5
         AND activo = TRUE
       RETURNING *`,
      [
        nombre.trim(),
        descripcion?.trim() || null,
        categoria.trim(),
        unidad_medida?.trim() || "pieza",
        id
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado o inactivo"
      });
    }

    res.json({
      mensaje: "Producto actualizado correctamente",
      producto: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al modificar el producto"
    });
  }
});


// DESACTIVAR UN PRODUCTO
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de producto invalido"
      });
    }

    const resultado = await pool.query(
      `UPDATE productos
       SET activo = FALSE,
           actualizado_en = NOW()
       WHERE id = $1
         AND activo = TRUE
       RETURNING *`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Producto no encontrado o ya inactivo"
      });
    }

    res.json({
      mensaje: "Producto desactivado correctamente",
      producto: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al desactivar el producto"
    });
  }
});

module.exports = router;
