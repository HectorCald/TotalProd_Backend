CREATE TABLE sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    empresa_id UUID NOT NULL,
    name VARCHAR NOT NULL DEFAULT 'Casa Matriz',
    CONSTRAINT sucursales_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);
