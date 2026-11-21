
require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./config/database");

async function crearAdmin() {
  try {
    const nombre = "Administrador";
    const email = "admin@transparenciasolidaria.org";

    // Solicitar la contraseña sin guardarla en el código.
    const password = process.env.ADMIN_PASSWORD;

    if (!password || password.length < 12) {
      throw new Error(
        "Define ADMIN_PASSWORD con al menos 12 caracteres en el archivo .env"
      );
    }

    const existente = await pool.query(
      "SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existente.rows.length > 0) {
      console.log("El usuario administrador ya existe.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, 'admin')`,
      [nombre, email, passwordHash]
    );

    console.log("Administrador creado correctamente.");
    console.log("Correo:", email);
  } catch (error) {
    console.error("Error al crear administrador:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

crearAdmin();
