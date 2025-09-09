CREATE TABLE products_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    category_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    type_measure_id UUID NOT NULL,
    quantity VARCHAR NOT NULL,
    CONSTRAINT products_acopio_type_measure_id_fkey 
        FOREIGN KEY (type_measure_id) REFERENCES type_measure (id),
    CONSTRAINT products_acopio_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users (id)
);
