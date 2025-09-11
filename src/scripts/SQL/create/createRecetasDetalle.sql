CREATE TABLE recetas_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receta_id UUID NOT NULL,
    producto_acopio_id UUID NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    CONSTRAINT recetas_detalle_receta_id_fkey
        FOREIGN KEY (receta_id) REFERENCES recetas (id) ON DELETE CASCADE,
    CONSTRAINT recetas_detalle_producto_acopio_id_fkey
        FOREIGN KEY (producto_acopio_id) REFERENCES products_acopio (id) ON DELETE CASCADE,
    CONSTRAINT recetas_detalle_unico UNIQUE (receta_id, producto_acopio_id)
);
