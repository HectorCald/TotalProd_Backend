-- Función RPC para actualizar múltiples stocks en una sola transacción
-- Esta función es mucho más eficiente que múltiples UPDATEs individuales

CREATE OR REPLACE FUNCTION update_stocks_batch(stock_updates JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    update_item JSONB;
    stock_id UUID;
    new_stock NUMERIC;
BEGIN
    -- Iterar sobre cada actualización
    FOR update_item IN SELECT * FROM jsonb_array_elements(stock_updates)
    LOOP
        -- Extraer ID y nuevo stock
        stock_id := (update_item->>'id')::UUID;
        new_stock := (update_item->>'stock')::NUMERIC;
        
        -- Actualizar el stock
        UPDATE productos_sucursal 
        SET stock = new_stock 
        WHERE id = stock_id;
        
        -- Verificar que se actualizó al menos una fila
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se encontró el registro con ID: %', stock_id;
        END IF;
    END LOOP;
END;
$$;

-- Comentario: Esta función permite actualizar múltiples stocks en una sola transacción
-- Es mucho más eficiente que hacer múltiples UPDATEs individuales
-- Uso: SELECT update_stocks_batch('[{"id": "uuid1", "stock": 100}, {"id": "uuid2", "stock": 200}]'::jsonb);
