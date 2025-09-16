CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location POINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_orders INT NOT NULL,
    sucu_id UUID NOT NULL,
    description TEXT,
    CONSTRAINT clients_sucu_id_fkey FOREIGN KEY (sucu_id) REFERENCES sucursales (id)
);
