CREATE TABLE sub_modulos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    CONSTRAINT sub_modulos_module_id_fkey
        FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE CASCADE
);
