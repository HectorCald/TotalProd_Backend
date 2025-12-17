-- ============================================================================
-- FUNCIONES RPC PARA TRANSACCIONES ATÓMICAS DE MOVIMIENTOS
-- ============================================================================

-- 1. Función para actualizar stocks en lote
-- ============================================================================
CREATE OR REPLACE FUNCTION update_stocks_batch(stock_updates jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    update_record jsonb;
BEGIN
    FOR update_record IN SELECT * FROM jsonb_array_elements(stock_updates)
    LOOP
        INSERT INTO productos_sucursal (producto_id, sucursal_id, stock)
        VALUES (
            (update_record->>'producto_id')::uuid,
            (update_record->>'sucursal_id')::uuid,
            (update_record->>'stock')::numeric
        )
        ON CONFLICT (producto_id, sucursal_id)
        DO UPDATE SET stock = (update_record->>'stock')::numeric;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se pudo actualizar stock para producto %', 
                (update_record->>'producto_id')::uuid;
        END IF;
    END LOOP;
END;
$$;

-- 2. Función para crear movimiento y actualizar stocks ATÓMICAMENTE
-- ============================================================================
CREATE OR REPLACE FUNCTION create_movimiento_atomico(
    movimiento_data jsonb,
    productos_data jsonb,
    stock_updates jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    new_movimiento_id uuid;
    producto_record jsonb;
    stock_record jsonb;
BEGIN
    -- 1. Insertar movimiento
    INSERT INTO movimientos_almacen (
        user_id,
        personal_id,
        sucu_id,
        type,
        observaciones,
        metodo_pago,
        cliente_id,
        proveedor_id,
        precio_id,
        restar_ingredientes,
        produccion_damabrava_id,
        agrupado,
        descuento,
        aumento,
        concepto,
        fecha,
        estado,
        numero_orden,
        ubicacion,
        porcentaje,
        gasto_id
    )
    VALUES (
        (movimiento_data->>'user_id')::text,
        (movimiento_data->>'personal_id')::text,
        (movimiento_data->>'sucu_id')::uuid,
        (movimiento_data->>'type')::text,
        (movimiento_data->>'observaciones')::text,
        (movimiento_data->>'metodo_pago')::text,
        (movimiento_data->>'cliente_id')::uuid,
        (movimiento_data->>'proveedor_id')::uuid,
        (movimiento_data->>'precio_id')::uuid,
        (movimiento_data->>'restar_ingredientes')::boolean,
        (movimiento_data->>'produccion_damabrava_id')::uuid,
        (movimiento_data->>'agrupado')::boolean,
        (movimiento_data->>'descuento')::numeric,
        (movimiento_data->>'aumento')::numeric,
        (movimiento_data->>'concepto')::text,
        (movimiento_data->>'fecha')::timestamptz,
        (movimiento_data->>'estado')::text,
        (movimiento_data->>'numero_orden')::integer,
        CASE 
            WHEN movimiento_data->>'ubicacion' IS NOT NULL AND movimiento_data->>'ubicacion' != '' 
            THEN (movimiento_data->>'ubicacion')::point
            ELSE NULL
        END,
        (movimiento_data->>'porcentaje')::boolean,
        (movimiento_data->>'gasto_id')::uuid
    )
    RETURNING id INTO new_movimiento_id;
    
    -- 2. Insertar productos del movimiento
    FOR producto_record IN SELECT * FROM jsonb_array_elements(productos_data)
    LOOP
        INSERT INTO movimiento_almacen_producto (
            movimiento_almacen_id,
            producto_almacen_id,
            cantidad,
            precio_unitario,
            subtotal
        )
        VALUES (
            new_movimiento_id,
            (producto_record->>'producto_almacen_id')::uuid,
            (producto_record->>'cantidad')::numeric,
            (producto_record->>'precio_unitario')::numeric,
            (producto_record->>'subtotal')::numeric
        );
    END LOOP;
    
    -- 3. Actualizar stocks (upsert)
    FOR stock_record IN SELECT * FROM jsonb_array_elements(stock_updates)
    LOOP
        INSERT INTO productos_sucursal (producto_id, sucursal_id, stock)
        VALUES (
            (stock_record->>'producto_id')::uuid,
            (stock_record->>'sucursal_id')::uuid,
            (stock_record->>'stock')::numeric
        )
        ON CONFLICT (producto_id, sucursal_id)
        DO UPDATE SET stock = (stock_record->>'stock')::numeric;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se pudo actualizar stock para producto %', 
                (stock_record->>'producto_id')::uuid;
        END IF;
    END LOOP;
    
    RETURN new_movimiento_id;
END;
$$;

-- 3. Función para anular movimiento y revertir stocks ATÓMICAMENTE
-- ============================================================================
CREATE OR REPLACE FUNCTION anular_movimiento_batch(
    movimiento_id uuid,
    stock_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    stock_record jsonb;
BEGIN
    -- 1. Actualizar estado del movimiento
    UPDATE movimientos_almacen
    SET estado = 'anulado'
    WHERE id = movimiento_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimiento % no encontrado', movimiento_id;
    END IF;
    
    -- 2. Revertir stocks
    FOR stock_record IN SELECT * FROM jsonb_array_elements(stock_updates)
    LOOP
        UPDATE productos_sucursal
        SET stock = (stock_record->>'stock')::numeric
        WHERE id = (stock_record->>'id')::uuid;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se pudo revertir stock con ID %', 
                (stock_record->>'id')::uuid;
        END IF;
    END LOOP;
END;
$$;

-- 4. Función para incrementar total_orders de cliente
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_cliente_total_orders(cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE clients
    SET total_orders = COALESCE(total_orders, 0) + 1
    WHERE id = cliente_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente % no encontrado', cliente_id;
    END IF;
END;
$$;

-- 5. Función para decrementar total_orders de cliente
-- ============================================================================
CREATE OR REPLACE FUNCTION decrement_cliente_total_orders(cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE clients
    SET total_orders = GREATEST(COALESCE(total_orders, 0) - 1, 0)
    WHERE id = cliente_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente % no encontrado', cliente_id;
    END IF;
END;
$$;

