CREATE TABLE recetas_acopio_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receta_acopio_id UUID NOT NULL,
    producto_acopio_id UUID NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    CONSTRAINT recetas_acopio_detalle_receta_id_fkey
        FOREIGN KEY (receta_acopio_id) REFERENCES recetas_acopio (id) ON DELETE CASCADE,
    CONSTRAINT recetas_acopio_detalle_producto_id_fkey
        FOREIGN KEY (producto_acopio_id) REFERENCES products_acopio (id) ON DELETE CASCADE,
    CONSTRAINT recetas_acopio_detalle_unico UNIQUE (receta_acopio_id, producto_acopio_id)
);