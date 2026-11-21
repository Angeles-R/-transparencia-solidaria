
const express = require("express");
const router = express.Router();

const pool = require("../config/database");

// CONSULTAR TODAS LAS DONACIONES
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        d.id,
        d.donante_id,
        dn.nombre AS nombre_donante,
        d.tipo,
        d.descripcion,
        d.monto,
        d.fecha_recepcion,
        d.estado,
        d.creado_en
      FROM donaciones d
      LEFT JOIN donantes dn
        ON d.donante_id = dn.id
      ORDER BY d.id DESC
    `);

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar las donaciones",
    });
  }
});

// CONSULTAR UNA DONACION POR ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de donacion invalido"
      });
    }

    const resultado = await pool.query(
      `SELECT
        d.id,
        d.donante_id,
        dn.nombre AS nombre_donante,
        d.tipo,
        d.descripcion,
        d.monto,
        d.fecha_recepcion,
        d.estado,
        d.creado_en
      FROM donaciones d
      LEFT JOIN donantes dn
        ON d.donante_id = dn.id
      WHERE d.id = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Donacion no encontrada"
      });
    }

    res.json(resultado.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al consultar la donacion"
    });
  }
});

// REGISTRAR UNA DONACION
router.post("/", async (req, res) => {
  try {
    const {
      donante_id,
      tipo,
      descripcion,
      monto
    } = req.body;

    if (!["economica", "especie"].includes(tipo)) {
      return res.status(400).json({
        mensaje: "El tipo debe ser economica o especie"
      });
    }

    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({
        mensaje: "La descripcion es obligatoria"
      });
    }

    let montoFinal = null;

    if (tipo === "economica") {
      montoFinal = Number(monto);

      if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
        return res.status(400).json({
          mensaje: "El monto debe ser mayor que cero"
        });
      }
    }

    if (tipo === "especie" && monto !== undefined && monto !== null && monto !== "") {
      return res.status(400).json({
        mensaje: "Las donaciones en especie no llevan monto"
      });
    }

    let donanteFinal = null;

    if (donante_id !== undefined && donante_id !== null && donante_id !== "") {
      if (!/^\d+$/.test(String(donante_id))) {
        return res.status(400).json({
          mensaje: "ID de donante invalido"
        });
      }

      const donante = await pool.query(
        "SELECT id FROM donantes WHERE id = $1 AND activo = TRUE",
        [donante_id]
      );

      if (donante.rows.length === 0) {
        return res.status(400).json({
          mensaje: "El donante no existe o esta inactivo"
        });
      }

      donanteFinal = donante_id;
    }

    const resultado = await pool.query(
      `INSERT INTO donaciones
       (donante_id, tipo, descripcion, monto)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [donanteFinal, tipo, descripcion.trim(), montoFinal]
    );

    res.status(201).json({
      mensaje: "Donacion registrada correctamente",
      donacion: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al registrar la donacion"
    });
  }
});

// MODIFICAR UNA DONACION
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, descripcion, monto } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de donacion invalido"
      });
    }

    if (!["economica", "especie"].includes(tipo)) {
      return res.status(400).json({
        mensaje: "El tipo debe ser economica o especie"
      });
    }

    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({
        mensaje: "La descripcion es obligatoria"
      });
    }

    let montoFinal = null;

    if (tipo === "economica") {
      montoFinal = Number(monto);

      if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
        return res.status(400).json({
          mensaje: "El monto debe ser mayor que cero"
        });
      }
    }

    if (tipo === "especie" && monto !== undefined && monto !== null && monto !== "") {
      return res.status(400).json({
        mensaje: "Las donaciones en especie no llevan monto"
      });
    }

    const resultado = await pool.query(
      `UPDATE donaciones
       SET tipo = $1,
           descripcion = $2,
           monto = $3
       WHERE id = $4
       RETURNING *`,
      [tipo, descripcion.trim(), montoFinal, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Donacion no encontrada"
      });
    }

    res.json({
      mensaje: "Donacion actualizada correctamente",
      donacion: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al modificar la donacion"
    });
  }
});

// CANCELAR UNA DONACION
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        mensaje: "ID de donacion invalido"
      });
    }

    const resultado = await pool.query(
      `UPDATE donaciones
       SET estado = 'cancelada'
       WHERE id = $1
         AND estado = 'recibida'
       RETURNING *`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Donacion no encontrada o ya cancelada"
      });
    }

    res.json({
      mensaje: "Donacion cancelada correctamente",
      donacion: resultado.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      mensaje: "Error al cancelar la donacion"
    });
  }
});

module.exports = router;
