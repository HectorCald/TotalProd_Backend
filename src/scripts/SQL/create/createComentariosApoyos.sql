CREATE TABLE public.comentarios_apoyos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comentario_id UUID NOT NULL REFERENCES public.comentarios(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    personal_id UUID NULL REFERENCES public.personal(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT comentarios_apoyos_unicos UNIQUE (comentario_id, user_id, personal_id)
);
