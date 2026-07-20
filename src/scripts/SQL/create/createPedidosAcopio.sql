CREATE TABLE pedidos_acopio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id TEXT NULL,
    observaciones VARCHAR NULL,
    estado VARCHAR NOT NULL,
    producto_acopio_id UUID NOT NULL DEFAULT gen_random_uuid(),
    cantidad NUMERIC NOT NULL,
    tipo_medida VARCHAR NOT NULL,
    empresa_id UUID NOT NULL,
    personal_id TEXT NULL,
    sucu_id UUID NOT NULL,
    entregado_por TEXT NULL,
    fecha_entregado DATE NULL,
    cantidad_entregada NUMERIC NULL,
    cantidad_entregada_ud NUMERIC NULL,
    cantidad_entregada_medida VARCHAR NULL,
    estado_entrega TEXT NULL,
    observaciones_entrega TEXT NULL,
    movimiento_entrada_id UUID NULL,
    gasto_id UUID NULL,
    gasto_otros_id UUID NULL,
    CONSTRAINT pedidos_acopio_gasto_otros_id_fkey 
        FOREIGN KEY (gasto_otros_id) REFERENCES gastos (id),
    CONSTRAINT pedidos_acopio_empresa_id_fkey 
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT pedidos_acopio_movimento_entrada_id_fkey 
        FOREIGN KEY (movimiento_entrada_id) REFERENCES movimientos_acopio (id),
    CONSTRAINT pedidos_acopio_producto_acopio_id_fkey 
        FOREIGN KEY (producto_acopio_id) REFERENCES products_acopio (id),
    CONSTRAINT pedidos_acopio_sucu_id_fkey 
        FOREIGN KEY (sucu_id) REFERENCES sucursales (id),
    CONSTRAINT pedidos_acopio_gasto_id_fkey 
        FOREIGN KEY (gasto_id) REFERENCES gastos (id)
);
