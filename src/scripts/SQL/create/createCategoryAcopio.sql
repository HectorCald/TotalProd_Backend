CREATE TABLE category_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    empresa_id UUID NOT NULL,
    CONSTRAINT category_acopio_empresa_id_fkey 
        FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);
