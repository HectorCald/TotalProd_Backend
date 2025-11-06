CREATE TABLE products_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    codigo_barras VARCHAR,
    category_id UUID,
    description VARCHAR,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    empresa_id UUID NOT NULL,
    grup NUMERIC,
    stock_minimo NUMERIC,
    costo_produccion NUMERIC,
    CONSTRAINT products_almacen_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES category_almacen (id) ON DELETE SET NULL,
    CONSTRAINT products_almacen_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);
