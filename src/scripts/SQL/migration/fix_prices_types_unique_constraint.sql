-- Script de migración para arreglar la restricción unique de prices_types
-- Cambiar de unique global a unique por empresa

-- Paso 1: Eliminar la restricción unique existente en name
ALTER TABLE prices_types DROP CONSTRAINT IF EXISTS prices_types_name_key;

-- Paso 2: Crear una nueva restricción unique compuesta (empresa_id, name)
-- Esto permite que diferentes empresas tengan tipos de precio con el mismo nombre
-- pero dentro de la misma empresa no puede haber duplicados
ALTER TABLE prices_types ADD CONSTRAINT prices_types_empresa_name_unique 
    UNIQUE (empresa_id, name);

-- Verificar que la migración fue exitosa
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'prices_types' AND constraint_type = 'UNIQUE';
