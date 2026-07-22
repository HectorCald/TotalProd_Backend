CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    location POINT,
    description TEXT,
    total_orders INT DEFAULT 0,
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT suppliers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches (id)
);
