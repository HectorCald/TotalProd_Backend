CREATE TABLE personal_modulo_permiso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_modulo_id UUID NOT NULL,
    personal_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT personal_modulo_permiso_personal_id_fkey 
        FOREIGN KEY (personal_id) REFERENCES personal (id),
    CONSTRAINT personal_modulo_permiso_sub_modulo_id_fkey 
        FOREIGN KEY (sub_modulo_id) REFERENCES sub_modulos (id)
);
