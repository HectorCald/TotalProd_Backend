CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location POINT,
    description TEXT,
    total_orders INT NOT NULL,
    sucu_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT clients_sucu_id_fkey FOREIGN KEY (sucu_id) REFERENCES sucursales (id)
);
