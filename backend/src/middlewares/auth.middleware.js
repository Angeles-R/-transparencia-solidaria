
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        mensaje: "Debes iniciar sesión para acceder",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const resultado = await pool.query(
      `SELECT id, nombre, email, rol, activo
       FROM usuarios
       WHERE id = $1`,
      [decoded.sub]
    );

    if (resultado.rows.length === 0 || !resultado.rows[0].activo) {
      return res.status(401).json({
        mensaje: "Usuario inexistente o inactivo",
      });
    }

    req.usuario = resultado.rows[0];

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: "Token inválido o expirado",
    });
  }
}

module.exports = authMiddleware;
