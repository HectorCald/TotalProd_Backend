CREATE TABLE recetas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_almacen_id UUID NOT NULL,
    descripcion VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT recetas_producto_almacen_id_fkey
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id) ON DELETE CASCADE
);
