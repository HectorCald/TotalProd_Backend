CREATE TABLE transferencias_almacen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id TEXT NULL,
    personal_id TEXT NULL,
    empresa_id UUID NOT NULL,

    sucu_origen_id UUID NOT NULL,
    sucu_destino_id UUID NOT NULL,

    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado VARCHAR NOT NULL DEFAULT 'Finalizado',
    concepto TEXT NULL,

    precio_id UUID NOT NULL,
    agrupado BOOLEAN NOT NULL DEFAULT FALSE,

    cliente_id UUID NULL,

    CONSTRAINT transferencias_almacen_cliente_id_fkey
        FOREIGN KEY (cliente_id) REFERENCES clients (id),
    
    CONSTRAINT transferencias_almacen_precio_id_fkey
        FOREIGN KEY (precio_id) REFERENCES prices_types (id),

    CONSTRAINT transferencias_almacen_sucu_origen_fkey
        FOREIGN KEY (sucu_origen_id) REFERENCES sucursales (id),

    CONSTRAINT transferencias_almacen_sucu_destino_fkey
        FOREIGN KEY (sucu_destino_id) REFERENCES sucursales (id),

    CONSTRAINT transferencias_almacen_empresa_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

-- Índices para filtros rápidos
CREATE INDEX idx_transferencias_almacen_fecha
    ON transferencias_almacen (fecha);

CREATE INDEX idx_transferencias_almacen_sucu_origen
    ON transferencias_almacen (sucu_origen_id);

CREATE INDEX idx_transferencias_almacen_sucu_destino
    ON transferencias_almacen (sucu_destino_id);

CREATE INDEX idx_transferencias_almacen_estado
    ON transferencias_almacen (estado);
