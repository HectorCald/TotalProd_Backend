CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    plan_id UUID REFERENCES plans(id),   -- 🔗 relación con la tabla plans
    created_at TIMESTAMP DEFAULT now()
);
