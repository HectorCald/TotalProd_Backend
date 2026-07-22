CREATE TABLE staff_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL,
    can_delete BOOLEAN NOT NULL,
    can_create BOOLEAN NOT NULL,
    can_update BOOLEAN NOT NULL,
    can_anular BOOLEAN NOT NULL,
    can_replace BOOLEAN NOT NULL,
    can_info BOOLEAN NOT NULL,
    can_sucursales BOOLEAN NOT NULL,
    can_offline BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT staff_permissions_member_id_fkey FOREIGN KEY (member_id) REFERENCES staff (id)
);
