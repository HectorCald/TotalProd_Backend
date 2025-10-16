CREATE TABLE conteos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha TIMESTAMPTZ NOT NULL,
  tipo VARCHAR(50) NOT NULL,                      -- Ej: "Conteo general", "Auditoría", "Cierre mensual"
  user_id UUID NULL,                              -- Usuario que inició el conteo
  personal_id UUID NULL,                          -- Personal que realizó el conteo
  sucursal_id UUID NOT NULL,                      -- Sucursal donde se hizo el conteo
  observaciones TEXT NULL,                        -- Observaciones generales del conteo
  CONSTRAINT conteos_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT conteos_personal_id_fkey 
    FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL,
  CONSTRAINT conteos_sucursal_id_fkey 
    FOREIGN KEY (sucursal_id) REFERENCES sucursales (id) ON DELETE CASCADE
);
