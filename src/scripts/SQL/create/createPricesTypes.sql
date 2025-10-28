CREATE TABLE prices_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT prices_types_empresa_id_fkey 
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT prices_types_empresa_name_unique 
        UNIQUE (empresa_id, name)
);
