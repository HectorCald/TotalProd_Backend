CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,   -- Ej: "Clientes", "Reportes"
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
    clave TEXT NULL
);
