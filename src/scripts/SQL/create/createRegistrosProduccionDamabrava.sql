CREATE TABLE registros_produccion_damabrava (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    producto_almacen_id UUID NOT NULL,
    lote NUMERIC NOT NULL,
    proceso TEXT NOT NULL,
    microondas NUMERIC NOT NULL,
    terminados NUMERIC NOT NULL,
    vencimiento DATE NOT NULL, -- Guardamos año-mes-día, puedes usar el día 1 del mes para representar mes/año
    user_id UUID NULL,
    personal_id UUID NULL,
    sucursal_id UUID NOT NULL,
    fecha_verificado DATE NULL,
    cantidad_verificada NUMERIC NULL,
    observaciones TEXT NULL,
    cantidad_ingresada NUMERIC NULL,
    estado VARCHAR(50) NOT NULL,

    CONSTRAINT registros_produccion_damabrava_producto_almacen_id_fkey
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id) ON DELETE CASCADE,

    CONSTRAINT registros_produccion_damabrava_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,

    CONSTRAINT registros_produccion_damabrava_personal_id_fkey
        FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL,

    CONSTRAINT registros_produccion_damabrava_sucursal_id_fkey
        FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE
);
