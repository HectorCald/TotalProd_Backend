CREATE TABLE plan_modules (
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    PRIMARY KEY(plan_id, module_id)
);
