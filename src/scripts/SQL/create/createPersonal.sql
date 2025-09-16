CREATE TABLE personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    celular VARCHAR,
    codigo VARCHAR NOT NULL,
    contraseña VARCHAR,
    CONSTRAINT personal_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
);
