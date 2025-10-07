CREATE TABLE pedidos_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT,
    empresa_id UUID,
    personal_id TEXT,
    observaciones VARCHAR,
    fecha TIMESTAMP NOT NULL DEFAULT now(),
    estado VARCHAR NOT NULL,
    sucursal_id UUID NOT NULL,
    precio_id UUID NOT NULL,
    sucursal_destino_id UUID NOT NULL,
    movimiento_salida_id UUID,
    movimiento_entrada_id UUID,
    deuda_id UUID,
    cliente_id UUID,
    agrupado BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT pedidos_almacen_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT pedidos_almacen_sucursal_id_fkey
        FOREIGN KEY (sucursal_id) REFERENCES sucursales (id),
    CONSTRAINT pedidos_almacen_precio_id_fkey
        FOREIGN KEY (precio_id) REFERENCES prices_types (id),
    CONSTRAINT pedidos_almacen_sucursal_destino_id_fkey
        FOREIGN KEY (sucursal_destino_id) REFERENCES sucursales (id),
    CONSTRAINT pedidos_almacen_movimiento_id_fkey
        FOREIGN KEY (movimiento_entrada_id) REFERENCES movimientos_almacen (id),
    CONSTRAINT pedidos_almacen_movimiento_salida_id_fkey
        FOREIGN KEY (movimiento_salida_id) REFERENCES movimientos_almacen (id),
    CONSTRAINT pedidos_almacen_deuda_id_fkey
        FOREIGN KEY (deuda_id) REFERENCES deudas (id),
    CONSTRAINT pedidos_almacen_cliente_id_fkey
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
);
