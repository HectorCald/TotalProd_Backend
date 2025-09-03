CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,   -- Ej: Free, Premium, Business
    price NUMERIC(10,2) NOT NULL,        -- Precio del plan
    duration INTERVAL NOT NULL,          -- Ej: '1 month', '1 year'
    description TEXT NOT NULL,           -- Descripción del plan
    created_at TIMESTAMP DEFAULT now()
);
