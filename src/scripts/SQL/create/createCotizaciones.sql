CREATE TABLE cotizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    sucu_id UUID NOT NULL,
    personal_id UUID,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones VARCHAR,
    metodo_pago TEXT,
    cliente_id UUID,
    estado VARCHAR NOT NULL DEFAULT 'pendiente',     -- Ej: pendiente, aprobada, rechazada
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    numero_cotizacion INTEGER NULL,
    fecha_vencimiento DATE NULL,                     -- Fecha hasta la cual es válida la cotización
    agrupado BOOLEAN NOT NULL DEFAULT FALSE,
    precio_id UUID,
    codigo TEXT NULL,
    CONSTRAINT cotizaciones_precio_id_fkey
        FOREIGN KEY (precio_id) REFERENCES prices_types (id),
    CONSTRAINT cotizaciones_cliente_id_fkey
        FOREIGN KEY (cliente_id) REFERENCES clients (id),
    CONSTRAINT cotizaciones_sucu_id_fkey
        FOREIGN KEY (sucu_id) REFERENCES sucursales (id)
    CONSTRAINT cotizaciones_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT cotizaciones_personal_id_fkey
        FOREIGN KEY (personal_id) REFERENCES personal (id),
);
