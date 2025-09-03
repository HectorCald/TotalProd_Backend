CREATE TABLE user_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),
    start_date TIMESTAMP DEFAULT now(),
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true
);
