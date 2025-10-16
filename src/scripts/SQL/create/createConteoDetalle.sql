CREATE TABLE conteo_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteo_id UUID NOT NULL,
  producto_almacen_id UUID NULL,     -- Producto del almacén (si aplica)
  producto_acopio_id UUID NULL,      -- Producto del acopio (si aplica)
  sistema NUMERIC NOT NULL,          -- Cantidad registrada en sistema
  fisico NUMERIC NOT NULL,           -- Cantidad contada físicamente
  justificacion TEXT NULL,           -- Explicación si hay diferencias
  CONSTRAINT conteo_detalle_conteo_id_fkey 
    FOREIGN KEY (conteo_id) REFERENCES conteos (id) ON DELETE CASCADE,
  CONSTRAINT conteo_detalle_producto_almacen_id_fkey 
    FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id) ON DELETE SET NULL,
  CONSTRAINT conteo_detalle_producto_acopio_id_fkey 
    FOREIGN KEY (producto_acopio_id) REFERENCES products_acopio (id) ON DELETE SET NULL
);
