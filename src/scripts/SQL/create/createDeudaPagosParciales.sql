CREATE TABLE deuda_pagos_parciales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deuda_id UUID NOT NULL,
    monto NUMERIC NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NULL,
    personal_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    detalle TEXT NULL,
    CONSTRAINT deuda_pagos_parciales_deuda_id_fkey
        FOREIGN KEY (deuda_id) REFERENCES deudas (id) ON DELETE CASCADE,
        
    CONSTRAINT deuda_pagos_parciales_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
        
    CONSTRAINT deuda_pagos_parciales_personal_id_fkey
        FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL
);
