CREATE TABLE pedidos_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT,
    personal_id TEXT,
    empresa_id UUID NOT NULL,
    observaciones VARCHAR,
    estado VARCHAR NOT NULL,
    producto_acopio_id UUID NOT NULL,
    cantidad NUMERIC NOT NULL,
    tipo_medida VARCHAR NOT NULL,
    sucu_id UUID NOT NULL,
    CONSTRAINT pedidos_acopio_producto_acopio_id_fkey
        FOREIGN KEY (producto_acopio_id) REFERENCES products_acopio (id),
    CONSTRAINT pedidos_acopio_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT pedidos_acopio_sucu_id_fkey
        FOREIGN KEY (sucu_id) REFERENCES sucursales (id)
);
