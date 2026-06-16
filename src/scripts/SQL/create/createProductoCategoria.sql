create table producto_categoria (
  id uuid not null default gen_random_uuid(),
  producto_id uuid not null,
  categoria_id uuid not null,
  constraint producto_categoria_pkey primary key (id),
  constraint producto_categoria_producto_id_fkey foreign KEY (producto_id) 
    references products_almacen (id) on delete cascade,
  constraint producto_categoria_categoria_id_fkey foreign KEY (categoria_id) 
    references category_almacen (id) on delete cascade,
  constraint producto_categoria_unique unique (producto_id, categoria_id)
);

create index idx_producto_categoria_producto_id 
  on producto_categoria using btree (producto_id);

create index idx_producto_categoria_categoria_id 
  on producto_categoria using btree (categoria_id);