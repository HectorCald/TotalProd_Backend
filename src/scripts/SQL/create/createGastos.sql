CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_gasto DATE NOT NULL,
    valor NUMERIC NOT NULL,
    concepto VARCHAR(255) NOT NULL,
    metodo_pago VARCHAR(100) NOT NULL,
    proveedor_id UUID NULL,
    user_id UUID NULL,
    personal_id UUID NULL,
    sucu_id UUID NULL,
    movimiento_entrada_id UUID NULL,
    CONSTRAINT gastos_proveedor_id_fkey 
        FOREIGN KEY (proveedor_id) REFERENCES proveedores (id) ON DELETE SET NULL,
    CONSTRAINT gastos_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT gastos_personal_id_fkey 
        FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL,
    CONSTRAINT gastos_sucu_id_fkey 
        FOREIGN KEY (sucu_id) REFERENCES sucursales (id) ON DELETE SET NULL
);

