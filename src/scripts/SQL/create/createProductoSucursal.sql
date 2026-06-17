-- Tabla de relación entre productos y sucursales
CREATE TABLE productos_sucursal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL,
    sucursal_id UUID NOT NULL,
    stock NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), --delete

    CONSTRAINT productos_sucursal_producto_id_fkey
        FOREIGN KEY (producto_id) REFERENCES products_almacen (id) ON DELETE CASCADE,

    CONSTRAINT productos_sucursal_sucursal_id_fkey
        FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE,

    CONSTRAINT productos_sucursal_unq UNIQUE (producto_id, sucursal_id)
);
