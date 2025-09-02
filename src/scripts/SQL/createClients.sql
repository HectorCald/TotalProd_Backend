CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location POINT, -- coordenadas lat/lon
    total_orders INT DEFAULT 0, -- contador de pedidos
    created_at TIMESTAMPTZ DEFAULT NOW()
);
