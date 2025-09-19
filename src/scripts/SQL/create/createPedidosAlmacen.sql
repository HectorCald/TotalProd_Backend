CREATE TABLE pedidos_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT,
    empresa_id UUID,
    personal_id TEXT,
    observaciones VARCHAR,
    fecha TIMESTAMP NOT NULL DEFAULT now(),
    estado VARCHAR NOT NULL,
    sucu_id UUID NOT NULL,
    precio_id UUID NOT NULL,
    entregado_por UUID,
    CONSTRAINT pedidos_almacen_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT pedidos_almacen_sucu_id_fkey
        FOREIGN KEY (sucu_id) REFERENCES sucursales (id),
    CONSTRAINT pedidos_almacen_precio_id_fkey
        FOREIGN KEY (precio_id) REFERENCES prices_types (id)
);
