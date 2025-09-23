-- Agregar índices para optimizar consultas en la tabla movimientos_almacen

-- Índice para sucu_id (filtro principal)
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_sucu_id ON movimientos_almacen (sucu_id);

-- Índice para fecha (filtro por fechas)
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_fecha ON movimientos_almacen (fecha);

-- Índice compuesto para sucu_id + fecha (consulta más común)
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_sucu_fecha ON movimientos_almacen (sucu_id, fecha);

-- Índice para type (entrada/salida)
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_type ON movimientos_almacen (type);

-- Índice compuesto para sucu_id + type + fecha (para filtrar salidas)
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_sucu_type_fecha ON movimientos_almacen (sucu_id, type, fecha);

-- Índice para user_id
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_user_id ON movimientos_almacen (user_id);

-- Índice para personal_id
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_personal_id ON movimientos_almacen (personal_id);

-- Índice para created_at (ordenamiento)
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_created_at ON movimientos_almacen (created_at DESC);
