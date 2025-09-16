CREATE TABLE category_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    CONSTRAINT category_almacen_empresa_id_fkey 
        FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);
