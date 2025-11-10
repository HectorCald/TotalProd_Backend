CREATE TABLE historial_acciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    modulo TEXT NOT NULL,               -- módulo o área del sistema (Ej: 'Almacén', 'Ventas')
    accion TEXT NOT NULL,               -- tipo de acción (CREAR, EDITAR, ELIMINAR, LOGIN, etc.)
    lugar_afectado TEXT NOT NULL,       -- descripción libre (Ej: 'Producto almacén (Harina)')
    registro_id UUID NULL,              -- ID del registro afectado, si aplica
    empresa_id UUID NOT NULL,
    user_id UUID NULL,
    personal_id UUID NULL,
    detalles JSONB NOT NULL,            -- información dinámica del cambio
    CONSTRAINT historial_acciones_empresa_id_fkey 
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT historial_acciones_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT historial_acciones_personal_id_fkey 
        FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL
);
