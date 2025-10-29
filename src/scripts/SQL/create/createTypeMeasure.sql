CREATE TABLE type_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    code_menor TEXT NOT NULL,
    value NUMERIC NOT NULL,
);
