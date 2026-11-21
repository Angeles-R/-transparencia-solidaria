
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        mensaje: "No se ha identificado al usuario",
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: "No tienes permisos para realizar esta operación",
      });
    }

    next();
  };
}

module.exports = permitirRoles;
