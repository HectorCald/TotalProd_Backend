-- Agregar campo precio a la tabla pedido_almacen_detalle
ALTER TABLE pedido_almacen_detalle 
ADD COLUMN precio NUMERIC(10,2) DEFAULT 0;
