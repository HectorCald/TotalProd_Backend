-- Cambiar el tipo de fecha_gasto de timestamp a date para solo manejar fechas
ALTER TABLE public.gastos 
ALTER COLUMN fecha_gasto TYPE DATE 
USING fecha_gasto::DATE;
