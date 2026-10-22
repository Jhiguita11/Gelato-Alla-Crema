-- ════════════════════════════════════════════════════════════════════════════
-- Gelato Alla Crema · carta editable por el administrador
--
-- La carta "de fábrica" sigue en el código (src/data/menu.js). Esta tabla
-- guarda solo los CAMBIOS que hace el admin desde la app:
--   · id     → id del producto (uno de fábrica o uno nuevo).
--   · datos  → campos editables (nombre, ícono, sección, precio o versiones,
--              porciones, salsa, incluye). null = sin cambios.
--   · oculto → quitado de la carta. Nunca se borra un producto de verdad: los
--              pedidos viejos lo siguen nombrando.
-- Restaurar un producto de fábrica = borrar su fila.
--
-- Quién puede qué:
--   · personal y admin → leer (todos los celulares arman la carta igual).
--   · solo admin       → cambiar, por las funciones de abajo, que responden
--                        'solo_admin' (la app lo muestra como aviso, no como
--                        sesión vencida).
-- ════════════════════════════════════════════════════════════════════════════

create table public.carta (
  id            text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  datos         jsonb check (datos is null or jsonb_typeof(datos) = 'object'),
  oculto        boolean not null default false,
  actualizado_at timestamptz not null default now()
);

alter table public.carta enable row level security;

create policy "personal y admin leen" on public.carta for select to authenticated
  using ((select public.es_personal()));

create policy "solo admin cambia" on public.carta for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

revoke all on public.carta from anon;

-- Guarda los campos editables. No toca `oculto`: editar y quitar son aparte.
create or replace function public.carta_guardar(p_id text, p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  insert into public.carta (id, datos) values (p_id, p_datos)
  on conflict (id) do update set datos = excluded.datos, actualizado_at = now();
end;
$$;

-- Quita o vuelve a poner un producto en la carta. No toca lo editado.
create or replace function public.carta_ocultar(p_id text, p_oculto boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  insert into public.carta (id, oculto) values (p_id, p_oculto)
  on conflict (id) do update set oculto = excluded.oculto, actualizado_at = now();
end;
$$;

-- Un producto de fábrica vuelve a como venía.
create or replace function public.carta_restaurar(p_id text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  delete from public.carta where id = p_id;
end;
$$;

revoke execute on function
  public.carta_guardar(text, jsonb),
  public.carta_ocultar(text, boolean),
  public.carta_restaurar(text)
  from public, anon;

grant execute on function
  public.carta_guardar(text, jsonb),
  public.carta_ocultar(text, boolean),
  public.carta_restaurar(text)
  to authenticated;

-- Los demás celulares ven el cambio al instante.
alter publication supabase_realtime add table public.carta;
