CREATE TABLE movimientos_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    sucu_id UUID NOT NULL,
    personal_id TEXT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones VARCHAR,
    metodo_pago TEXT,
    cliente_id UUID,
    proveedor_id UUID,
    estado VARCHAR,
    type VARCHAR NOT NULL,
    precio_id UUID NOT NULL,
    deuda_id UUID NULL,
    produccion_damabrava_id UUID NULL,
    restar_ingredientes BOOLEAN NOT NULL DEFAULT FALSE,
    agrupado BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT movimientos_almacen_cliente_id_fkey
        FOREIGN KEY (cliente_id) REFERENCES clients (id),
    CONSTRAINT movimientos_almacen_proveedor_id_fkey
        FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
    CONSTRAINT movimientos_almacen_sucu_id_fkey
        FOREIGN KEY (sucu_id) REFERENCES sucursales (id),
    CONSTRAINT movimientos_almacen_precio_id_fkey
        FOREIGN KEY (precio_id) REFERENCES prices_types (id),
    CONSTRAINT movimientos_almacen_deuda_id_fkey
        FOREIGN KEY (deuda_id) REFERENCES deudas (id),
    CONSTRAINT movimientos_almacen_produccion_damabrava_id_fkey
        FOREIGN KEY (produccion_damabrava_id) REFERENCES registros_produccion_damabrava (id)
);