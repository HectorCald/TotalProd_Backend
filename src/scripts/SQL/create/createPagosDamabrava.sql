CREATE TABLE pagos_damabrava (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Relaciones con usuario, personal y empresa
    user_id UUID NULL,
    personal_id UUID NULL,
    empresa_id UUID NOT NULL,
    responsable_id UUID NOT NULL,

    -- Producción
    etiquetado NUMERIC NULL,
    sellado NUMERIC NULL,
    envasado NUMERIC NULL,
    cernido NUMERIC NULL,

    -- Periodo pagado
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,

    -- Totales y estado
    total NUMERIC NOT NULL DEFAULT 0,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',

    -- otros
    extras NUMERIC NULL,
    descuento NUMERIC NULL,
    aumento NUMERIC NULL,

    -- Relaciones externas
    CONSTRAINT pagos_damabrava_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT pagos_damabrava_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT pagos_damabrava_personal_id_fkey
        FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL,
    CONSTRAINT pagos_damabrava_responsable_id_fkey
        FOREIGN KEY (responsable_id) REFERENCES personal (id)
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_pagos_damabrava_empresa_id 
    ON pagos_damabrava (empresa_id);

CREATE INDEX IF NOT EXISTS idx_pagos_damabrava_personal_id 
    ON pagos_damabrava (personal_id);

CREATE INDEX IF NOT EXISTS idx_pagos_damabrava_responsable_id 
    ON pagos_damabrava (responsable_id);

CREATE INDEX IF NOT EXISTS idx_pagos_damabrava_estado 
    ON pagos_damabrava (estado);

CREATE INDEX IF NOT EXISTS idx_pagos_damabrava_fecha 
    ON pagos_damabrava (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_damabrava_rango_fechas 
    ON pagos_damabrava (fecha_inicio, fecha_fin);
