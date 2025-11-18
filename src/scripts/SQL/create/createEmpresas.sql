CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name VARCHAR NOT NULL,
    description VARCHAR,
    propietario_id UUID NOT NULL,
    logo_tipo TEXT NULL,
    tipo TEXT NULL,
    codigo TEXT NULL,
    CONSTRAINT empresas_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES users (id)
);
