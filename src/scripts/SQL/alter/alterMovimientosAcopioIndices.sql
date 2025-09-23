-- Agregar índices para optimizar consultas en la tabla movimientos_acopio

-- Índice para sucu_id (filtro principal)
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_sucu_id ON movimientos_acopio (sucu_id);

-- Índice para date (filtro por fechas)
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_date ON movimientos_acopio (date);

-- Índice compuesto para sucu_id + date (consulta más común)
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_sucu_date ON movimientos_acopio (sucu_id, date);

-- Índice para type (entrada/salida)
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_type ON movimientos_acopio (type);

-- Índice compuesto para sucu_id + type + date (para filtrar entradas con costo)
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_sucu_type_date ON movimientos_acopio (sucu_id, type, date);

-- Índice para product_id
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_product_id ON movimientos_acopio (product_id);

-- Índice para user_id
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_user_id ON movimientos_acopio (user_id);

-- Índice para personal_id
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_personal_id ON movimientos_acopio (personal_id);
