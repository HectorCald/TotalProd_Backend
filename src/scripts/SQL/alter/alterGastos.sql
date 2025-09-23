-- Agregar las columnas faltantes a la tabla gastos
ALTER TABLE public.gastos 
ADD COLUMN user_id UUID NULL,
ADD COLUMN personal_id UUID NULL,
ADD COLUMN sucu_id UUID NULL;

-- Agregar las foreign keys
ALTER TABLE public.gastos 
ADD CONSTRAINT gastos_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE public.gastos 
ADD CONSTRAINT gastos_personal_id_fkey 
    FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL;

ALTER TABLE public.gastos 
ADD CONSTRAINT gastos_sucu_id_fkey 
    FOREIGN KEY (sucu_id) REFERENCES sucursales (id) ON DELETE SET NULL;
