CREATE TABLE products_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description VARCHAR,
    category_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    type_measure_id UUID NOT NULL,
    quantity NUMERIC NOT NULL,
    empresa_id UUID NOT NULL,
    stock_minimo NUMERIC,
    CONSTRAINT products_acopio_type_measure_id_fkey 
        FOREIGN KEY (type_measure_id) REFERENCES type_measure (id),
    CONSTRAINT products_acopio_empresa_id_fkey 
        FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);
