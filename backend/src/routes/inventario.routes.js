
const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// CONSULTAR EXISTENCIAS DE TODOS LOS PRODUCTOS
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        p.id AS producto_id,
        p.nombre,
        p.categoria,
        p.unidad_medida,
        COALESCE(
          SUM(
            CASE
              WHEN m.tipo = 'entrada' THEN m.cantidad
              WHEN m.tipo = 'salida' THEN -m.cantidad
              WHEN m.tipo = 'ajuste' THEN m.cantidad
              ELSE 0
            END
          ), 0
        ) AS existencias
      FROM productos p
      LEFT JOIN inventario_movimientos m
        ON m.producto_id = p.id
      WHERE p.activo = TRUE
      GROUP BY p.id, p.nombre, p.categoria, p.unidad_medida
      ORDER BY p.nombre ASC
    `);

    res.json(resultado.rows);

  } catch (error) {
    console.error("Error al consultar inventario:", error.message);
    res.status(500).json({
      mensaje: "Error al consultar el inventario"
    });
  }
});

// CONSULTAR HISTORIAL DE MOVIMIENTOS
router.get("/movimientos", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        m.id,
        m.producto_id,
        p.nombre AS producto,
        m.donacion_id,
        m.entrega_id,
        m.tipo,
        m.cantidad,
        m.observaciones,
        m.creado_en
      FROM inventario_movimientos m
      INNER JOIN productos p ON p.id = m.producto_id
      ORDER BY m.id DESC
    `);

    res.json(resultado.rows);

  } catch (error) {
    console.error("Error al consultar movimientos:", error.message);
    res.status(500).json({
      mensaje: "Error al consultar los movimientos"
    });
  }
});

// CONSULTAR HISTORIAL DE UN PRODUCTO
router.get("/producto/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      mensaje: "ID de producto inválido"
    });
  }

  try {
    const resultado = await pool.query(`
      SELECT
        m.id,
        m.producto_id,
        p.nombre AS producto,
        m.donacion_id,
        m.entrega_id,
        m.tipo,
        m.cantidad,
        m.observaciones,
        m.creado_en
      FROM inventario_movimientos m
      INNER JOIN productos p ON p.id = m.producto_id
      WHERE m.producto_id = $1
      ORDER BY m.id DESC
    `, [id]);

    res.json(resultado.rows);

  } catch (error) {
    console.error("Error al consultar historial:", error.message);
    res.status(500).json({
      mensaje: "Error al consultar el historial del producto"
    });
  }
});

// REGISTRAR ENTRADA O AJUSTE DE INVENTARIO
router.post("/", async (req, res) => {
  const {
    producto_id,
    tipo,
    cantidad,
    observaciones
  } = req.body;

  if (
    !producto_id ||
    !Number.isSafeInteger(Number(producto_id)) ||
    Number(producto_id) <= 0 ||
    !["entrada", "ajuste"].includes(tipo) ||
    !Number.isFinite(Number(cantidad)) ||
    Number(cantidad) <= 0
  ) {
    return res.status(400).json({
      mensaje: "Producto, tipo y cantidad deben ser válidos"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const producto = await client.query(
      "SELECT id FROM productos WHERE id = $1 AND activo = TRUE FOR UPDATE",
      [producto_id]
    );

    if (producto.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        mensaje: "Producto no encontrado o inactivo"
      });
    }

    if (tipo === "ajuste") {
      const movimientos = await client.query(`
        SELECT COALESCE(
          SUM(
            CASE
              WHEN tipo = 'entrada' THEN cantidad
              WHEN tipo = 'salida' THEN -cantidad
              WHEN tipo = 'ajuste' THEN cantidad
              ELSE 0
            END
          ), 0
        ) AS existencias
        FROM inventario_movimientos
        WHERE producto_id = $1
      `, [producto_id]);

      if (Number(movimientos.rows[0].existencias) + Number(cantidad) < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          mensaje: "El ajuste no puede generar existencias negativas"
        });
      }
    }

    const resultado = await client.query(`
      INSERT INTO inventario_movimientos
        (producto_id, tipo, cantidad, observaciones)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      producto_id,
      tipo,
      cantidad,
      observaciones || null
    ]);

    await client.query("COMMIT");

    res.status(201).json({
      mensaje: "Movimiento de inventario registrado correctamente",
      movimiento: resultado.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al registrar movimiento:", error.message);
    res.status(500).json({
      mensaje: "Error al registrar el movimiento"
    });
  } finally {
    client.release();
  }
});

// REGISTRAR SALIDA DE INVENTARIO
router.post("/salida", async (req, res) => {
  const { producto_id, cantidad, observaciones } = req.body;

  if (
    !producto_id ||
    !Number.isSafeInteger(Number(producto_id)) ||
    Number(producto_id) <= 0 ||
    !Number.isFinite(Number(cantidad)) ||
    Number(cantidad) <= 0
  ) {
    return res.status(400).json({
      mensaje: "Producto y cantidad deben ser válidos"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const producto = await client.query(
      "SELECT id FROM productos WHERE id = $1 AND activo = TRUE FOR UPDATE",
      [producto_id]
    );

    if (producto.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        mensaje: "Producto no encontrado o inactivo"
      });
    }

    const existencia = await client.query(`
      SELECT COALESCE(
        SUM(
          CASE
            WHEN tipo = 'entrada' THEN cantidad
            WHEN tipo = 'salida' THEN -cantidad
            WHEN tipo = 'ajuste' THEN cantidad
            ELSE 0
          END
        ), 0
      ) AS disponible
      FROM inventario_movimientos
      WHERE producto_id = $1
    `, [producto_id]);

    const disponible = Number(existencia.rows[0].disponible);

    if (disponible < Number(cantidad)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "Existencias insuficientes",
        disponible
      });
    }

    const resultado = await client.query(`
      INSERT INTO inventario_movimientos
        (producto_id, tipo, cantidad, observaciones)
      VALUES ($1, 'salida', $2, $3)
      RETURNING *
    `, [
      producto_id,
      cantidad,
      observaciones || null
    ]);

    await client.query("COMMIT");

    res.status(201).json({
      mensaje: "Salida de inventario registrada correctamente",
      movimiento: resultado.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al registrar salida:", error.message);
    res.status(500).json({
      mensaje: "Error al registrar la salida"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
