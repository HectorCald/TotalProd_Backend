-- Agregar columna restar_ingredientes a la tabla movimientos_acopio
ALTER TABLE movimientos_acopio 
ADD COLUMN restar_ingredientes BOOLEAN NOT NULL DEFAULT FALSE;
