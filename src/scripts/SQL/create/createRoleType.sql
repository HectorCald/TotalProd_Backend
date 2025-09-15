CREATE TABLE role_type (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    CONSTRAINT role_type_pkey PRIMARY KEY (id)
);
