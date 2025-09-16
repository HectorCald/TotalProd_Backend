CREATE TABLE proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location POINT, -- coordenadas lat/lon
    description TEXT,
    total_orders INT DEFAULT 0, -- contador de pedidos
    sucu_id UUID REFERENCES sucursales(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT proveedores_sucu_id_fkey FOREIGN KEY (sucu_id) REFERENCES sucursales (id)
);
