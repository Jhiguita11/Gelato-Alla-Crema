-- ════════════════════════════════════════════════════════════════════════════
-- Gelato Alla Crema · rol de administrador
--
-- Dos cuentas:
--   · personal  local@gelatoallacrema.app  (PIN)        → trabaja el día en curso
--   · admin     cualquier usuario con app_metadata.rol = 'admin' (contraseña)
--               → todo lo del personal + historial, días anteriores y reportes
--
-- app_metadata solo se puede cambiar desde el servidor (SQL o service_role):
-- nadie puede volverse admin desde la app.
--
-- Además, borrar y "limpiar" pedidos dejan de borrar de verdad:
--   · limpiar despachados y pagados → los oculta de la lista (siguen contando
--     en la caja y en los reportes; antes desaparecían las ventas).
--   · eliminar un pedido → lo anula: no cuenta, pero queda registro de quién y
--     cuándo, y el admin lo ve en los reportes.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Quién es quién ──────────────────────────────────────────────────────────
create or replace function public.es_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') = 'admin'
$$;

-- Alguien del local: el personal o el admin.
create or replace function public.es_personal()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.es_local() or public.es_admin()
$$;

-- Todas las funciones que llaman a exigir_local() aceptan ahora también al
-- admin (el admin puede hacer todo lo que hace el personal).
create or replace function public.exigir_local()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.es_personal() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.exigir_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = '42501';
  end if;
end;
$$;

-- ── Pedidos: ocultar y anular en vez de borrar ──────────────────────────────
alter table public.pedidos
  add column oculto     boolean not null default false,
  add column anulado_at timestamptz,
  add column anulado_por text;

-- ── Reglas ──────────────────────────────────────────────────────────────────
-- Personal: solo la jornada en curso. Admin: todo.
drop policy "solo el local" on public.jornada;
drop policy "solo el local" on public.vitrina;
drop policy "solo el local" on public.pedidos;
drop policy "solo el local" on public.turnos;
drop policy "solo el local" on public.cierres;

create policy "personal y admin" on public.jornada for all to authenticated
  using ((select public.es_personal())) with check ((select public.es_personal()));

create policy "personal y admin" on public.vitrina for all to authenticated
  using ((select public.es_personal())) with check ((select public.es_personal()));

create policy "personal: el día; admin: todo" on public.pedidos for all to authenticated
  using (
    (select public.es_admin())
    or ((select public.es_local()) and jornada_id = (select public.jornada_actual()))
  )
  with check (
    (select public.es_admin())
    or ((select public.es_local()) and jornada_id = (select public.jornada_actual()))
  );

create policy "personal: el día; admin: todo" on public.turnos for all to authenticated
  using (
    (select public.es_admin())
    or ((select public.es_local()) and jornada_id = (select public.jornada_actual()))
  )
  with check (
    (select public.es_admin())
    or ((select public.es_local()) and jornada_id = (select public.jornada_actual()))
  );

-- El historial de cierres es solo del admin. El personal cierra la caja con
-- cerrar_caja(), que guarda el cierre sin dejarle leerlo después.
create policy "solo admin" on public.cierres for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- ── Operaciones ─────────────────────────────────────────────────────────────

-- crear_pedido corre con permisos del servidor para que un reintento de la
-- cola encuentre el pedido aunque la caja ya se haya cerrado (el personal no
-- ve jornadas pasadas). Revisa a mano quién llama.
create or replace function public.crear_pedido(p jsonb)
returns public.pedidos
language plpgsql
security definer
set search_path = ''
as $$
declare
  existente public.pedidos;
  j         public.jornada;
  nuevo     public.pedidos;
begin
  perform public.exigir_local();

  select * into existente from public.pedidos where id = (p ->> 'id')::uuid;
  if found then
    return existente; -- reintento de la cola: ya había llegado
  end if;

  update public.jornada set contador = contador + 1 where id = 1 returning * into j;

  insert into public.pedidos (
    id, jornada_id, code, mesa, cliente, tomado_por, nota, lineas,
    estado, pagado, total, creado_at, pagado_at
  ) values (
    (p ->> 'id')::uuid,
    j.jornada_id,
    lpad(j.contador::text, 3, '0'),
    p ->> 'table',
    coalesce(p ->> 'customer', ''),
    nullif(p ->> 'takenBy', ''),
    coalesce(p ->> 'note', ''),
    coalesce(p -> 'lines', '[]'::jsonb),
    'pendiente',
    coalesce((p ->> 'paid')::boolean, false),
    coalesce((p ->> 'total')::integer, 0),
    coalesce(to_timestamp((p ->> 'createdAt')::double precision / 1000), now()),
    case when coalesce((p ->> 'paid')::boolean, false)
      then coalesce(to_timestamp((p ->> 'paidAt')::double precision / 1000), now())
    end
  )
  returning * into nuevo;

  return nuevo;
end;
$$;

-- Oculta de la lista los entregados Y cobrados. Siguen contando en la caja.
create or replace function public.limpiar_despachados()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_local();
  update public.pedidos
     set oculto = true
   where jornada_id = public.jornada_actual()
     and estado = 'despachado'
     and pagado
     and not oculto;
end;
$$;

-- Cierra la caja. Corre con permisos del servidor: el personal puede cerrar
-- el día aunque no pueda leer el historial, y solo recibe el id del cierre.
--  · 'ya_cerrada'     → otro celular cerró primero esta jornada.
--  · 'desactualizada' → el resumen no incluye todos los pedidos.
-- Los anulados no cuentan (tampoco en el resumen de la app).
drop function public.cerrar_caja(uuid, uuid, uuid, timestamptz, jsonb);
create function public.cerrar_caja(
  p_jornada    uuid,
  p_nueva      uuid,
  p_cierre_id  uuid,
  p_cerrado_at timestamptz,
  p_datos      jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  j        public.jornada;
  cuantos  integer;
begin
  perform public.exigir_local();

  if exists (select 1 from public.cierres where id = p_cierre_id) then
    return p_cierre_id; -- reintento de la cola
  end if;

  select * into j from public.jornada where id = 1 for update;
  if j.jornada_id is distinct from p_jornada then
    raise exception 'ya_cerrada';
  end if;

  select count(*) into cuantos
    from public.pedidos
   where jornada_id = p_jornada and anulado_at is null;
  if cuantos <> coalesce((p_datos ->> 'pedidos')::integer, -1) then
    raise exception 'desactualizada';
  end if;

  insert into public.cierres (id, jornada_id, cerrado_at, datos)
  values (p_cierre_id, p_jornada, coalesce(p_cerrado_at, now()), p_datos);

  update public.jornada
     set jornada_id = p_nueva, contador = 0, abierta_at = now()
   where id = 1;

  update public.turnos
     set jornada_id = p_nueva, inicio = now()
   where jornada_id = p_jornada and fin is null;

  return p_cierre_id;
end;
$$;

-- ── Permisos de ejecución ───────────────────────────────────────────────────
revoke execute on function
  public.es_admin(),
  public.es_personal(),
  public.exigir_admin(),
  public.cerrar_caja(uuid, uuid, uuid, timestamptz, jsonb)
  from public, anon;

grant execute on function
  public.es_admin(),
  public.es_personal(),
  public.exigir_admin(),
  public.cerrar_caja(uuid, uuid, uuid, timestamptz, jsonb)
  to authenticated;

-- ── Marcar al administrador ─────────────────────────────────────────────────
-- Después de crear el usuario en Authentication → Users, correr UNA vez
-- (cambiando el email si se usa otro):
--
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol":"admin"}'
--    where email = 'admin@gelatoallacrema.app';
--
-- El rol entra en el token la próxima vez que esa cuenta inicie sesión.
