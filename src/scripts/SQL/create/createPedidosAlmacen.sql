CREATE TABLE pedidos_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT,
    empresa_id UUID,
    personal_id TEXT,
    observaciones VARCHAR,
    fecha TIMESTAMP NOT NULL DEFAULT now(),
    estado VARCHAR NOT NULL,
    CONSTRAINT pedidos_almacen_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);
