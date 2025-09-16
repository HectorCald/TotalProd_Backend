CREATE TABLE personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    celular VARCHAR,
    codigo VARCHAR NOT NULL,
    password VARCHAR,  -- cambié "contraseña" a "password" para consistencia
    is_active BOOLEAN NOT NULL DEFAULT true,
    sucursal_id UUID,
    CONSTRAINT personal_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresa (id),
    CONSTRAINT personal_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES sucursales (id)
);
