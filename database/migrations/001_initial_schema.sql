-- ==========================================
-- TRANSPARENCIA SOLIDARIA
-- Migracion inicial de la base de datos
-- PostgreSQL 16+
-- ==========================================

-- 1. USUARIOS Y SEGURIDAD
CREATE TABLE usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL
        CHECK (rol IN ('admin', 'operador')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. DONANTES
CREATE TABLE donantes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(150),
    tipo VARCHAR(20) NOT NULL DEFAULT 'persona'
        CHECK (tipo IN ('persona', 'empresa', 'organizacion')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. DONACIONES
CREATE TABLE donaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    donante_id BIGINT REFERENCES donantes(id) ON DELETE RESTRICT,
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('economica', 'especie')),
    descripcion TEXT NOT NULL,
    monto NUMERIC(12,2),
    fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado VARCHAR(20) NOT NULL DEFAULT 'recibida'
        CHECK (estado IN ('recibida', 'cancelada')),
    creado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (tipo = 'economica' AND monto IS NOT NULL AND monto > 0)
        OR
        (tipo = 'especie' AND monto IS NULL)
    )
);

-- 4. PRODUCTOS
CREATE TABLE productos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(80) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL DEFAULT 'pieza',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BENEFICIARIOS
CREATE TABLE beneficiarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    direccion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ENTREGAS
CREATE TABLE entregas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    beneficiario_id BIGINT NOT NULL
        REFERENCES beneficiarios(id) ON DELETE RESTRICT,
    fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    descripcion TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'realizada'
        CHECK (estado IN ('realizada', 'cancelada')),
    creado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. MOVIMIENTOS DE INVENTARIO
CREATE TABLE inventario_movimientos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    producto_id BIGINT NOT NULL
        REFERENCES productos(id) ON DELETE RESTRICT,
    donacion_id BIGINT REFERENCES donaciones(id) ON DELETE RESTRICT,
    entrega_id BIGINT REFERENCES entregas(id) ON DELETE RESTRICT,
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    observaciones TEXT,
    creado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. AUDITORIA
CREATE TABLE auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(30) NOT NULL,
    entidad VARCHAR(60) NOT NULL,
    entidad_id BIGINT,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDICES PARA CONSULTAS FRECUENTES
CREATE INDEX idx_donaciones_donante
    ON donaciones(donante_id);

CREATE INDEX idx_donaciones_fecha
    ON donaciones(fecha_recepcion);

CREATE INDEX idx_movimientos_producto
    ON inventario_movimientos(producto_id);

CREATE INDEX idx_entregas_beneficiario
    ON entregas(beneficiario_id);

CREATE INDEX idx_auditoria_fecha
    ON auditoria(creado_en);

CREATE INDEX idx_auditoria_entidad
    ON auditoria(entidad, entidad_id);