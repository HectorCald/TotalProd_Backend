CREATE TABLE recetas_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    producto_acopio_id UUID NOT NULL,
    description VARCHAR,
    CONSTRAINT recetas_acopio_producto_acopio_id_fkey
        FOREIGN KEY (producto_acopio_id) REFERENCES products_acopio (id) ON DELETE CASCADE
);