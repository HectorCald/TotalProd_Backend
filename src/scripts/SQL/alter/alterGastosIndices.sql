-- Agregar índices para optimizar consultas en la tabla gastos

-- Índice para sucu_id (filtro principal)
CREATE INDEX IF NOT EXISTS idx_gastos_sucu_id ON gastos (sucu_id);

-- Índice para fecha_gasto (filtro por fechas)
CREATE INDEX IF NOT EXISTS idx_gastos_fecha_gasto ON gastos (fecha_gasto);

-- Índice compuesto para sucu_id + fecha_gasto (consulta más común)
CREATE INDEX IF NOT EXISTS idx_gastos_sucu_fecha ON gastos (sucu_id, fecha_gasto);

-- Índice para user_id
CREATE INDEX IF NOT EXISTS idx_gastos_user_id ON gastos (user_id);

-- Índice para personal_id
CREATE INDEX IF NOT EXISTS idx_gastos_personal_id ON gastos (personal_id);

-- Índice para proveedor_id
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor_id ON gastos (proveedor_id);

-- Índice para created_at (ordenamiento)
CREATE INDEX IF NOT EXISTS idx_gastos_created_at ON gastos (created_at DESC);
