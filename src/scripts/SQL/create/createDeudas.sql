CREATE TABLE deudas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_deuda DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    monto_total NUMERIC NOT NULL,
    saldo_pendiente NUMERIC NOT NULL,
    concepto VARCHAR(255) NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente', -- pendiente | pagada | vencida
    cliente_id UUID NULL,
    user_id UUID NULL,        -- usuario del sistema que registró
    personal_id UUID NULL,    -- empleado relacionado
    sucu_id UUID NULL,        -- sucursal
    movimiento_salida_id UUID NOT NULL,
    destino_sucursal_id UUID NULL,

    CONSTRAINT deudas_destino_sucursal_id_fkey FOREIGN KEY (destino_sucursal_id) REFERENCES sucursales (id) ON DELETE SET NULL,
    CONSTRAINT deudas_movimiento_salida_id_fkey FOREIGN KEY (movimiento_salida_id) REFERENCES movimientos_almacen (id) ON DELETE SET NULL,
    CONSTRAINT deudas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clients (id) ON DELETE SET NULL,
    CONSTRAINT deudas_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT deudas_personal_id_fkey FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL,
    CONSTRAINT deudas_sucu_id_fkey FOREIGN KEY (sucu_id) REFERENCES sucursales (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_deudas_cliente_id ON deudas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_deudas_sucu_id ON deudas (sucu_id);
CREATE INDEX IF NOT EXISTS idx_deudas_fecha_deuda ON deudas (fecha_deuda);
CREATE INDEX IF NOT EXISTS idx_deudas_fecha_vencimiento ON deudas (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_deudas_estado ON deudas (estado);
CREATE INDEX IF NOT EXISTS idx_deudas_user_id ON deudas (user_id);
CREATE INDEX IF NOT EXISTS idx_deudas_personal_id ON deudas (personal_id);
CREATE INDEX IF NOT EXISTS idx_deudas_created_at ON deudas (created_at DESC);
