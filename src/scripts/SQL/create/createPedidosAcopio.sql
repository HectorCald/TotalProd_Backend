CREATE TABLE pedidos_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL,
    observaciones VARCHAR,
    estado VARCHAR NOT NULL,
    CONSTRAINT pedidos_acopio_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users (id)
);
