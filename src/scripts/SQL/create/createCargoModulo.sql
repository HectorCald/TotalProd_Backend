create table cargo_sub_modulo (
  id uuid not null default gen_random_uuid(),
  cargo_id uuid not null,
  sub_modulo_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint cargo_sub_modulo_pkey primary key (id),
  constraint cargo_sub_modulo_cargo_id_fkey foreign key (cargo_id) references cargos (id) on delete cascade,
  constraint cargo_sub_modulo_sub_modulo_id_fkey foreign key (sub_modulo_id) references sub_modulos (id) on delete cascade
);