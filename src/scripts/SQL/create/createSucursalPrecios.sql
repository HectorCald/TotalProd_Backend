CREATE TABLE sucursal_precios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL,
    precio_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT sucursal_precios_sucursal_id_fkey
        FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE,
        
    CONSTRAINT sucursal_precios_precio_id_fkey
        FOREIGN KEY (precio_id) REFERENCES prices_types (id) ON DELETE CASCADE,
        
    CONSTRAINT sucursal_precios_unico UNIQUE (sucursal_id, precio_id)
);
