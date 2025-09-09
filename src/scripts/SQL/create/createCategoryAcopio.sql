CREATE TABLE category_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    user_id UUID NOT NULL,
    CONSTRAINT category_acopio_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users (id)
);
