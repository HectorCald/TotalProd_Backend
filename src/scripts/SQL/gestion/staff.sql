CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    phone VARCHAR,
    email VARCHAR NOT NULL,
    position_id UUID,
    password VARCHAR,
    is_active BOOLEAN NOT NULL DEFAULT true,
    branch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_company_id_fkey FOREIGN KEY (company_id) REFERENCES empresas (id),
    CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT staff_position_id_fkey FOREIGN KEY (position_id) REFERENCES cargos (id)
);
