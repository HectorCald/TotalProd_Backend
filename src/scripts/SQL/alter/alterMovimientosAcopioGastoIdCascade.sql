-- Actualizar el constraint de gasto_id para que tenga CASCADE DELETE

-- Primero eliminar el constraint existente
ALTER TABLE movimientos_acopio 
DROP CONSTRAINT IF EXISTS movimientos_acopio_gasto_id_fkey;

-- Agregar el constraint con CASCADE DELETE
ALTER TABLE movimientos_acopio 
ADD CONSTRAINT movimientos_acopio_gasto_id_fkey 
FOREIGN KEY (gasto_id) REFERENCES gastos (id) ON DELETE CASCADE;

-- Agregar comentario a la columna
COMMENT ON COLUMN movimientos_acopio.gasto_id IS 'ID del gasto asociado cuando se registra un costo en la entrada. Se elimina automáticamente al eliminar el gasto.';
