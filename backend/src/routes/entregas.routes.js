
const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// CONSULTAR TODAS LAS ENTREGAS
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        e.id,
        e.beneficiario_id,
        b.nombre AS beneficiario,
        e.fecha_entrega,
        e.descripcion,
        e.estado,
        e.creado_en,
        COALESCE(
          json_agg(
            json_build_object(
              'producto_id', p.id,
              'producto', p.nombre,
              'cantidad', ed.cantidad,
              'observaciones', ed.observaciones
            )
          ) FILTER (WHERE ed.id IS NOT NULL),
          '[]'
        ) AS productos
      FROM entregas e
      INNER JOIN beneficiarios b ON b.id = e.beneficiario_id
      LEFT JOIN entrega_detalles ed ON ed.entrega_id = e.id
      LEFT JOIN productos p ON p.id = ed.producto_id
      GROUP BY e.id, b.nombre
      ORDER BY e.id DESC
    `);

    res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar entregas:", error.message);
    res.status(500).json({ mensaje: "Error al consultar las entregas" });
  }
});

// CONSULTAR UNA ENTREGA
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ mensaje: "ID inválido" });
  }

  try {
    const resultado = await pool.query(`
      SELECT
        e.id,
        e.beneficiario_id,
        b.nombre AS beneficiario,
        e.fecha_entrega,
        e.descripcion,
        e.estado,
        e.creado_en,
        COALESCE(
          json_agg(
            json_build_object(
              'producto_id', p.id,
              'producto', p.nombre,
              'cantidad', ed.cantidad,
              'observaciones', ed.observaciones
            )
          ) FILTER (WHERE ed.id IS NOT NULL),
          '[]'
        ) AS productos
      FROM entregas e
      INNER JOIN beneficiarios b ON b.id = e.beneficiario_id
      LEFT JOIN entrega_detalles ed ON ed.entrega_id = e.id
      LEFT JOIN productos p ON p.id = ed.producto_id
      WHERE e.id = $1
      GROUP BY e.id, b.nombre
    `, [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Entrega no encontrada" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Error al consultar entrega:", error.message);
    res.status(500).json({ mensaje: "Error al consultar la entrega" });
  }
});

// REGISTRAR UNA ENTREGA Y DESCONTAR PRODUCTOS DEL INVENTARIO
router.post("/", async (req, res) => {
  const {
    beneficiario_id,
    descripcion,
    productos
  } = req.body;

  if (
    !beneficiario_id ||
    !descripcion ||
    !descripcion.trim() ||
    !Array.isArray(productos) ||
    productos.length === 0
  ) {
    return res.status(400).json({
      mensaje: "Beneficiario, descripción y al menos un producto son obligatorios"
    });
  }

  const ids = productos.map(p => Number(p.producto_id));

  if (
    ids.some(id => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(ids).size !== ids.length ||
    productos.some(p =>
      !Number.isFinite(Number(p.cantidad)) || Number(p.cantidad) <= 0
    )
  ) {
    return res.status(400).json({
      mensaje: "Los productos o sus cantidades no son válidos"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const beneficiario = await client.query(
      "SELECT id FROM beneficiarios WHERE id = $1 AND activo = TRUE FOR UPDATE",
      [beneficiario_id]
    );

    if (beneficiario.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "El beneficiario no existe o está inactivo"
      });
    }

    // Bloquear los productos para evitar descuentos simultáneos incorrectos.
    for (const producto of productos) {
      const productoDb = await client.query(
        "SELECT id FROM productos WHERE id = $1 AND activo = TRUE FOR UPDATE",
        [producto.producto_id]
      );

      if (productoDb.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          mensaje: `El producto ${producto.producto_id} no existe o está inactivo`
        });
      }

      // Las existencias se calculan mediante entradas menos salidas.
      const existencia = await client.query(`
        SELECT COALESCE(
          SUM(
            CASE
              WHEN tipo = 'entrada' THEN cantidad
              WHEN tipo = 'salida' THEN -cantidad
              ELSE 0
            END
          ), 0
        ) AS disponible
        FROM inventario_movimientos
        WHERE producto_id = $1
      `, [producto.producto_id]);

      const disponible = Number(existencia.rows[0].disponible);

      if (disponible < Number(producto.cantidad)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          mensaje: `Existencia insuficiente para el producto ${producto.producto_id}`,
          disponible
        });
      }
    }

    const nuevaEntrega = await client.query(`
      INSERT INTO entregas (beneficiario_id, descripcion)
      VALUES ($1, $2)
      RETURNING *
    `, [beneficiario_id, descripcion.trim()]);

    const entrega = nuevaEntrega.rows[0];

    for (const producto of productos) {
      await client.query(`
        INSERT INTO entrega_detalles
          (entrega_id, producto_id, cantidad, observaciones)
        VALUES ($1, $2, $3, $4)
      `, [
        entrega.id,
        producto.producto_id,
        producto.cantidad,
        producto.observaciones || null
      ]);

      await client.query(`
        INSERT INTO inventario_movimientos
          (producto_id, entrega_id, tipo, cantidad, observaciones)
        VALUES ($1, $2, 'salida', $3, $4)
      `, [
        producto.producto_id,
        entrega.id,
        producto.cantidad,
        "Salida por entrega comunitaria"
      ]);
    }

    await client.query("COMMIT");

    res.status(201).json({
      mensaje: "Entrega registrada correctamente",
      entrega
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al registrar entrega:", error.message);
    res.status(500).json({ mensaje: "Error al registrar la entrega" });
  } finally {
    client.release();
  }
});

// MODIFICAR LOS DATOS GENERALES DE UNA ENTREGA
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { beneficiario_id, descripcion } = req.body;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ mensaje: "ID inválido" });
  }

  if (!beneficiario_id || !descripcion || !descripcion.trim()) {
    return res.status(400).json({
      mensaje: "Beneficiario y descripción son obligatorios"
    });
  }

  try {
    const resultado = await pool.query(`
      UPDATE entregas
      SET beneficiario_id = $1,
          descripcion = $2
      WHERE id = $3
        AND estado = 'realizada'
        AND EXISTS (
          SELECT 1 FROM beneficiarios
          WHERE id = $1 AND activo = TRUE
        )
      RETURNING *
    `, [beneficiario_id, descripcion.trim(), id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Entrega no encontrada o beneficiario inactivo"
      });
    }

    res.json({
      mensaje: "Entrega actualizada correctamente",
      entrega: resultado.rows[0]
    });

  } catch (error) {
    console.error("Error al actualizar entrega:", error.message);
    res.status(500).json({ mensaje: "Error al actualizar la entrega" });
  }
});

// CANCELAR ENTREGA Y DEVOLVER PRODUCTOS AL INVENTARIO
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ mensaje: "ID inválido" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const entregaDb = await client.query(
      "SELECT * FROM entregas WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (
      entregaDb.rows.length === 0 ||
      entregaDb.rows[0].estado !== "realizada"
    ) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        mensaje: "Entrega no encontrada o ya cancelada"
      });
    }

    const detalles = await client.query(
      "SELECT producto_id, cantidad FROM entrega_detalles WHERE entrega_id = $1",
      [id]
    );

    for (const detalle of detalles.rows) {
      await client.query(`
        INSERT INTO inventario_movimientos
          (producto_id, entrega_id, tipo, cantidad, observaciones)
        VALUES ($1, $2, 'entrada', $3, $4)
      `, [
        detalle.producto_id,
        id,
        detalle.cantidad,
        "Devolución por cancelación de entrega"
      ]);
    }

    const resultado = await client.query(`
      UPDATE entregas
      SET estado = 'cancelada'
      WHERE id = $1
      RETURNING *
    `, [id]);

    await client.query("COMMIT");

    res.json({
      mensaje: "Entrega cancelada y productos devueltos al inventario",
      entrega: resultado.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al cancelar entrega:", error.message);
    res.status(500).json({ mensaje: "Error al cancelar la entrega" });
  } finally {
    client.release();
  }
});

module.exports = router;
