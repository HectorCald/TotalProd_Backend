CREATE TABLE reglas_produccion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Usuario o personal que registró la regla
    user_id UUID NULL,
    personal_id UUID NULL,

    -- Empresa propietaria de la regla
    empresa_id UUID NOT NULL,

    -- Información de la regla
    contiene TEXT NULL,
    general BOOLEAN NULL,
    cernido NUMERIC NULL,
    sellado NUMERIC NULL,
    envasado NUMERIC NULL,
    etiquetado NUMERIC NULL,
    producto_almacen_id UUID NULL,
    desde_gramaje NUMERIC NULL,
    hasta_gramaje NUMERIC NULL,

    -- Relaciones con otras tablas
    CONSTRAINT reglas_produccion_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresas (id),

    CONSTRAINT reglas_produccion_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,

    CONSTRAINT reglas_produccion_personal_id_fkey
        FOREIGN KEY (personal_id) REFERENCES personal (id) ON DELETE SET NULL,

    CONSTRAINT reglas_produccion_producto_almacen_id_fkey
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.insert_regla_produccion(
    p_empresa_id uuid,
    p_es_general boolean,
    p_contiene text,
    p_producto_almacen_id uuid,
    p_sellado numeric,
    p_cernido numeric,
    p_envasado numeric,
    p_etiquetado numeric,
    p_user_id uuid DEFAULT NULL,
    p_personal_id uuid DEFAULT NULL,
    p_desde_gramaje numeric DEFAULT NULL,
    p_hasta_gramaje numeric DEFAULT NULL
)
RETURNS reglas_produccion
LANGUAGE plpgsql
AS $$
DECLARE
    v_regla reglas_produccion;
BEGIN
    INSERT INTO reglas_produccion (
        empresa_id,
        general,
        contiene,
        producto_almacen_id,
        sellado,
        cernido,
        envasado,
        etiquetado,
        user_id,
        personal_id,
        desde_gramaje,
        hasta_gramaje
    )
    VALUES (
        p_empresa_id,
        p_es_general,
        CASE 
            WHEN COALESCE(p_es_general, FALSE) THEN NULL 
            ELSE NULLIF(trim(p_contiene), '') 
        END,
        CASE 
            WHEN COALESCE(p_es_general, FALSE) THEN NULL 
            ELSE p_producto_almacen_id 
        END,
        p_sellado,
        p_cernido,
        p_envasado,
        p_etiquetado,
        p_user_id,
        p_personal_id,
        CASE 
            WHEN p_desde_gramaje IS NULL OR trim(p_desde_gramaje::text) = '' THEN NULL 
            ELSE p_desde_gramaje 
        END,
        CASE 
            WHEN p_hasta_gramaje IS NULL OR trim(p_hasta_gramaje::text) = '' THEN NULL 
            ELSE p_hasta_gramaje 
        END
    )
    RETURNING * INTO v_regla;

    RETURN v_regla;
END;
$$;