CREATE TABLE personal_permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id UUID NOT NULL,
    can_delete BOOLEAN NOT NULL,
    can_create BOOLEAN NOT NULL,
    can_update BOOLEAN NOT NULL,
    can_anular BOOLEAN NOT NULL,
    can_replace BOOLEAN NOT NULL,
    can_info BOOLEAN NOT NULL,
    can_sucursales BOOLEAN NOT NULL,
    can_offline BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT personal_permisos_personal_id_fkey 
        FOREIGN KEY (personal_id) REFERENCES personal (id)
);
