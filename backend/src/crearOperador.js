
require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./config/database");

async function crearOperador() {
  try {
    const nombre = "Operador de prueba";
    const email = "operador@transparenciasolidaria.org";
    const password = process.env.OPERATOR_PASSWORD;

    if (!password || password.length < 12) {
      throw new Error(
        "Define OPERATOR_PASSWORD con al menos 12 caracteres en .env"
      );
    }

    const existente = await pool.query(
      "SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existente.rows.length > 0) {
      console.log("El usuario operador ya existe.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, 'operador')`,
      [nombre, email, passwordHash]
    );

    console.log("Operador creado correctamente.");
    console.log("Correo:", email);
  } catch (error) {
    console.error("Error al crear operador:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

crearOperador();
