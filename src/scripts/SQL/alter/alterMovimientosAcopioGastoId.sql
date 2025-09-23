-- Agregar columna gasto_id a la tabla movimientos_acopio

-- Agregar la columna gasto_id (si no existe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'movimientos_acopio' 
                   AND column_name = 'gasto_id') THEN
        ALTER TABLE movimientos_acopio ADD COLUMN gasto_id UUID;
    END IF;
END $$;

-- Agregar foreign key constraint (si no existe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'movimientos_acopio_gasto_id_fkey') THEN
        ALTER TABLE movimientos_acopio 
        ADD CONSTRAINT movimientos_acopio_gasto_id_fkey 
        FOREIGN KEY (gasto_id) REFERENCES gastos (id) ON DELETE CASCADE;
    END IF;
END $$;

-- Agregar comentario a la columna
COMMENT ON COLUMN movimientos_acopio.gasto_id IS 'ID del gasto asociado cuando se registra un costo en la entrada';
