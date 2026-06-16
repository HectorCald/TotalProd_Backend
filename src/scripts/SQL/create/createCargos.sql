create table cargos (
  id uuid not null default gen_random_uuid(),
  name varchar(100) not null,
  empresa_id uuid not null,
  description text,
  created_at timestamp with time zone not null default now(),
  constraint cargos_pkey primary key (id),
  constraint cargos_empresa_id_fkey foreign key (empresa_id) references empresas (id) on delete cascade
);