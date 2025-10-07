CREATE TABLE sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    empresa_id UUID NOT NULL,
    almacen_sucursal_id UUID NULL,
    name VARCHAR NOT NULL DEFAULT 'Casa Matriz',
    CONSTRAINT sucursales_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT sucursales_almacen_sucursal_id_fkey FOREIGN KEY (almacen_sucursal_id) REFERENCES sucursales (id)
);
