CREATE TABLE movimientos_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones VARCHAR,
    metodo_pago VARCHAR,
    cliente_id UUID,
    proveedor_id UUID,
    estado VARCHAR
    tipo VARCHAR NOT NULL,
    CONSTRAINT movimientos_almacen_cliente_id_fkey
        FOREIGN KEY (cliente_id) REFERENCES clients (id),
    CONSTRAINT movimientos_almacen_proveedor_id_fkey
        FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    CONSTRAINT movimientos_almacen_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id)
);