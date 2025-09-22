CREATE TABLE public.comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    personal_id UUID NULL REFERENCES public.personal(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('error', 'sugerencia', 'felicitacion', 'ayuda')),
    mensaje TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
