CREATE TABLE planificador_tareas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha DATE NOT NULL,
    frecuencia VARCHAR(20) NOT NULL DEFAULT 'unica',
    titulo VARCHAR(255) NOT NULL,
    detalles TEXT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
    responsable_id UUID NULL,
    empresa_id UUID NOT NULL,
    creado_por_user_id UUID NULL,
    creado_por_personal_id UUID NULL,
    CONSTRAINT planificador_tareas_responsable_id_fkey
        FOREIGN KEY (responsable_id) REFERENCES staff (id) ON DELETE SET NULL,
    CONSTRAINT planificador_tareas_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id) ON DELETE CASCADE,
    CONSTRAINT planificador_tareas_creado_por_user_id_fkey
        FOREIGN KEY (creado_por_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT planificador_tareas_creado_por_personal_id_fkey
        FOREIGN KEY (creado_por_personal_id) REFERENCES staff (id) ON DELETE SET NULL,
    CONSTRAINT planificador_tareas_frecuencia_check
        CHECK (frecuencia IN ('unica', 'semanal', 'mensual')),
    CONSTRAINT planificador_tareas_estado_check
        CHECK (estado IN ('Pendiente', 'En Progreso', 'Completado'))
);
