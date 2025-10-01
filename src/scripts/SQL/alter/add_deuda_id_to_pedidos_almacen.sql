-- Agregar columna deuda_id a la tabla pedidos_almacen
ALTER TABLE pedidos_almacen 
ADD COLUMN deuda_id UUID;

-- Agregar foreign key constraint
ALTER TABLE pedidos_almacen 
ADD CONSTRAINT pedidos_almacen_deuda_id_fkey 
FOREIGN KEY (deuda_id) REFERENCES deudas (id);
