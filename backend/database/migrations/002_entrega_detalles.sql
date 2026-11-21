
CREATE TABLE entrega_detalles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    entrega_id BIGINT NOT NULL,
    producto_id BIGINT NOT NULL,

    cantidad NUMERIC(12,2) NOT NULL,

    observaciones TEXT,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT entrega_detalles_cantidad_check
        CHECK (cantidad > 0),

    CONSTRAINT entrega_detalles_entrega_fkey
        FOREIGN KEY (entrega_id)
        REFERENCES entregas(id)
        ON DELETE RESTRICT,

    CONSTRAINT entrega_detalles_producto_fkey
        FOREIGN KEY (producto_id)
        REFERENCES productos(id)
        ON DELETE RESTRICT,

    CONSTRAINT entrega_detalles_entrega_producto_unique
        UNIQUE (entrega_id, producto_id)
);

CREATE INDEX idx_entrega_detalles_entrega
    ON entrega_detalles(entrega_id);

CREATE INDEX idx_entrega_detalles_producto
    ON entrega_detalles(producto_id);
