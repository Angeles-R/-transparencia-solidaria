
const express = require("express");
const pool = require("./config/database");
require("dotenv").config();

const authMiddleware = require("./middlewares/auth.middleware");
const donantesRoutes = require("./routes/donantes.routes");
const donacionesRoutes = require("./routes/donaciones.routes");
const productosRoutes = require("./routes/productos.routes");
const beneficiariosRoutes = require("./routes/beneficiarios.routes");
const entregasRoutes = require("./routes/entregas.routes");
const inventarioRoutes = require("./routes/inventario.routes");
const authRoutes = require("./routes/auth.routes");
const usuariosRoutes = require("./routes/usuarios.routes");

const app = express();

app.use(express.json());

app.use("/api/donantes", authMiddleware, donantesRoutes);
app.use("/api/donaciones", authMiddleware, donacionesRoutes);
app.use("/api/productos", authMiddleware, productosRoutes);
app.use("/api/beneficiarios", authMiddleware, beneficiariosRoutes);
app.use("/api/entregas", authMiddleware, entregasRoutes);
app.use("/api/inventario", authMiddleware, inventarioRoutes);
app.use("/api/usuarios", authMiddleware, usuariosRoutes);

app.use("/api/auth", authRoutes);

app.get("/api/health", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT current_database(), current_user, NOW()"
    );

    res.json({
      mensaje: "Transparencia Solidaria API funcionando",
      baseDatos: resultado.rows[0].current_database,
      usuario: resultado.rows[0].current_user,
      fechaServidor: resultado.rows[0].now,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      mensaje: "Error al consultar PostgreSQL",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
