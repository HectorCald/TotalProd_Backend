-- ACTUALIZAR FUNCIÓN RPC PARA ELIMINAR VALIDACIÓN DE PEDIDOS
-- Ejecutar este comando para actualizar la función RPC existente

-- Función RPC actualizada SIN validación de pedidos relacionados
CREATE OR REPLACE FUNCTION eliminar_movimiento_atomico(movimiento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    movimiento_exists BOOLEAN;
BEGIN
    -- Verificar que el movimiento existe y está anulado
    SELECT EXISTS(
        SELECT 1 FROM movimientos_almacen 
        WHERE id = movimiento_id 
        AND estado = 'anulado'
    ) INTO movimiento_exists;
    
    IF NOT movimiento_exists THEN
        RAISE EXCEPTION 'Movimiento no encontrado o no está anulado: %', movimiento_id;
    END IF;
    
    -- Eliminar productos relacionados
    DELETE FROM movimiento_almacen_producto 
    WHERE movimiento_almacen_id = movimiento_id;
    
    -- Eliminar movimiento principal
    DELETE FROM movimientos_almacen 
    WHERE id = movimiento_id;
    
    -- Verificar que se eliminó
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo eliminar el movimiento: %', movimiento_id;
    END IF;
END;
$$;

-- Verificar que la función se actualizó correctamente
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'eliminar_movimiento_atomico';
