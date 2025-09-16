CREATE TABLE movimientos_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    user_id TEXT,
    personal_id TEXT,
    sucu_id UUID NOT NULL,
    type VARCHAR NOT NULL,
    observations VARCHAR,
    proveedor_id UUID,
    quantity VARCHAR NOT NULL,
    estado VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT movimientos_acopio_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products_acopio (id),
    CONSTRAINT movimientos_acopio_proveedor_id_fkey 
        FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    CONSTRAINT movimientos_acopio_sucu_id_fkey 
        FOREIGN KEY (sucu_id) REFERENCES sucursales (id)
);
