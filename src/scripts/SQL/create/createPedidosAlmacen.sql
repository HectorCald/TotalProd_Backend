CREATE TABLE pedidos_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL,
    observaciones VARCHAR,
    fecha TIMESTAMP NOT NULL DEFAULT now(),
    estado VARCHAR NOT NULL,
    CONSTRAINT pedidos_almacen_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id)
);
