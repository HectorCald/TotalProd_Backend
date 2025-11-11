CREATE TABLE registro_pago_damabrava (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registro_produccion_damabrava_id UUID NOT NULL,
    registro_pago_damabrava_id UUID NOT NULL,

    CONSTRAINT registro_pago_damabrava_produccion_fkey
        FOREIGN KEY (registro_produccion_damabrava_id)
        REFERENCES registros_produccion_damabrava (id)
        ON DELETE CASCADE,

    CONSTRAINT registro_pago_damabrava_pago_fkey
        FOREIGN KEY (registro_pago_damabrava_id)
        REFERENCES pagos_damabrava (id)
        ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_registro_pago_damabrava_pago_id 
    ON registro_pago_damabrava (registro_pago_damabrava_id);

CREATE INDEX IF NOT EXISTS idx_registro_pago_damabrava_produccion_id 
    ON registro_pago_damabrava (registro_produccion_damabrava_id);
