-- ════════════════════════════════════════════════════════════════════════════
-- Gelato Alla Crema · pedidos compartidos entre celulares
--
-- Todos los celulares del local leen y escriben aquí. Solo puede hacerlo el
-- usuario del local (el que entra con el PIN): la clave pública que va dentro
-- de la app, sola, no puede ver ni tocar nada.
--
-- Nombres en español; la app convierte a sus nombres de siempre en
-- src/sync/remoto.js.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Quién puede entrar ──────────────────────────────────────────────────────
-- El email tiene que coincidir con EMAIL_LOCAL en src/sync/config.js.
-- Revisar el email (y no solo "estar logueado") cierra la puerta aunque alguien
-- lograra crear otra cuenta en el proyecto.
create or replace function public.es_local()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'local@gelatoallacrema.app'
$$;

-- ── Jornada: el "día de caja", de un cierre al siguiente ────────────────────
-- Una sola fila. `contador` da los números de pedido (#001, #002…): se
-- incrementa con un UPDATE que bloquea la fila, así dos celulares nunca
-- reciben el mismo número.
create table public.jornada (
  id          smallint primary key default 1 check (id = 1),
  jornada_id  uuid        not null default gen_random_uuid(),
  contador    integer     not null default 0 check (contador >= 0),
  abierta_at  timestamptz not null default now()
);
insert into public.jornada (id) values (1);

create or replace function public.jornada_actual()
returns uuid
language sql
stable
set search_path = ''
as $$
  select jornada_id from public.jornada where id = 1
$$;

-- ── Pedidos ─────────────────────────────────────────────────────────────────
-- El id lo genera el celular: si la cola reintenta un pedido que ya había
-- llegado, no se duplica. Los pedidos de jornadas cerradas se quedan (sirven
-- para reportes); la app solo pide los de la jornada actual.
create table public.pedidos (
  id             uuid primary key,
  jornada_id     uuid        not null default public.jornada_actual(),
  code           text        not null,
  mesa           text        not null,
  cliente        text        not null default '',
  tomado_por     text,
  nota           text        not null default '',
  lineas         jsonb       not null default '[]'::jsonb,
  estado         text        not null default 'pendiente'
                   check (estado in ('pendiente', 'despachado')),
  pagado         boolean     not null default false,
  total          integer     not null default 0 check (total >= 0),
  creado_at      timestamptz not null default now(),
  despachado_at  timestamptz,
  pagado_at      timestamptz
);
create index pedidos_jornada_idx on public.pedidos (jornada_id, creado_at desc);

-- ── Turnos: quién atendió y cuánto tiempo ───────────────────────────────────
create table public.turnos (
  id          uuid primary key,
  jornada_id  uuid        not null default public.jornada_actual(),
  persona     text        not null,
  inicio      timestamptz not null default now(),
  fin         timestamptz
);
create index turnos_jornada_idx on public.turnos (jornada_id);

-- ── Cierres de caja ─────────────────────────────────────────────────────────
-- `datos` es el resumen tal como lo arma la app (resumenDelDia). jornada_id es
-- único: una jornada se cierra una sola vez. Los importados de un respaldo
-- viejo no tienen jornada.
create table public.cierres (
  id          uuid primary key,
  jornada_id  uuid unique,
  cerrado_at  timestamptz not null,
  datos       jsonb       not null
);
create index cierres_fecha_idx on public.cierres (cerrado_at desc);

-- ── Vitrina: qué hay hoy ────────────────────────────────────────────────────
create table public.vitrina (
  id                  smallint primary key default 1 check (id = 1),
  fecha               date,
  sabores             text[] not null default '{}',
  productos_agotados  text[] not null default '{}',
  sabores_extra       jsonb  not null default '[]'::jsonb
);
insert into public.vitrina (id) values (1);

-- ════════════════════════════════════════════════════════════════════════════
-- Seguridad: nada para anónimos, todo para el local.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.jornada enable row level security;
alter table public.pedidos enable row level security;
alter table public.turnos  enable row level security;
alter table public.cierres enable row level security;
alter table public.vitrina enable row level security;

-- (select …) hace que Postgres evalúe la regla una vez por consulta, no por fila.
create policy "solo el local" on public.jornada for all to authenticated
  using ((select public.es_local())) with check ((select public.es_local()));
create policy "solo el local" on public.pedidos for all to authenticated
  using ((select public.es_local())) with check ((select public.es_local()));
create policy "solo el local" on public.turnos for all to authenticated
  using ((select public.es_local())) with check ((select public.es_local()));
create policy "solo el local" on public.cierres for all to authenticated
  using ((select public.es_local())) with check ((select public.es_local()));
create policy "solo el local" on public.vitrina for all to authenticated
  using ((select public.es_local())) with check ((select public.es_local()));

revoke all on public.jornada, public.pedidos, public.turnos, public.cierres, public.vitrina
  from anon;

-- ════════════════════════════════════════════════════════════════════════════
-- Operaciones que tienen que ser atómicas. Corren con los permisos de quien
-- llama (security invoker), así que las reglas de arriba también aplican aquí.
-- Todas son idempotentes: la cola del celular puede reintentarlas sin miedo.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.exigir_local()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.es_local() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;
end;
$$;

-- Crea un pedido y le asigna el siguiente número de la jornada.
-- `p` es el pedido tal como lo arma la app (ids, fechas en milisegundos).
create or replace function public.crear_pedido(p jsonb)
returns public.pedidos
language plpgsql
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

-- Borra de la vista los pedidos entregados Y cobrados de la jornada actual.
create or replace function public.limpiar_despachados()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_local();
  delete from public.pedidos
   where jornada_id = public.jornada_actual()
     and estado = 'despachado'
     and pagado;
end;
$$;

-- Cierra la caja: guarda el resumen, abre una jornada nueva (numeración en
-- #001) y pasa a ella los turnos de quien siga conectado.
--  · 'ya_cerrada'     → otro celular cerró primero esta jornada.
--  · 'desactualizada' → el resumen no incluye todos los pedidos (llegó uno de
--                       otro celular mientras tanto): hay que revisar y volver
--                       a cerrar.
create or replace function public.cerrar_caja(
  p_jornada    uuid,
  p_nueva      uuid,
  p_cierre_id  uuid,
  p_cerrado_at timestamptz,
  p_datos      jsonb
)
returns public.cierres
language plpgsql
set search_path = ''
as $$
declare
  j        public.jornada;
  cierre   public.cierres;
  cuantos  integer;
begin
  perform public.exigir_local();

  select * into cierre from public.cierres where id = p_cierre_id;
  if found then
    return cierre; -- reintento de la cola
  end if;

  select * into j from public.jornada where id = 1 for update;
  if j.jornada_id is distinct from p_jornada then
    raise exception 'ya_cerrada';
  end if;

  select count(*) into cuantos from public.pedidos where jornada_id = p_jornada;
  if cuantos <> coalesce((p_datos ->> 'pedidos')::integer, -1) then
    raise exception 'desactualizada';
  end if;

  insert into public.cierres (id, jornada_id, cerrado_at, datos)
  values (p_cierre_id, p_jornada, coalesce(p_cerrado_at, now()), p_datos)
  returning * into cierre;

  update public.jornada
     set jornada_id = p_nueva, contador = 0, abierta_at = now()
   where id = 1;

  update public.turnos
     set jornada_id = p_nueva, inicio = now()
   where jornada_id = p_jornada and fin is null;

  return cierre;
end;
$$;

-- Abre un turno en la jornada actual.
create or replace function public.entrar(p_id uuid, p_persona text, p_inicio timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_local();
  insert into public.turnos (id, persona, inicio)
  values (p_id, p_persona, coalesce(p_inicio, now()))
  on conflict (id) do nothing;
end;
$$;

-- Prende o apaga un sabor o un producto en la vitrina. Toca solo ese valor
-- del arreglo, así dos celulares cambiando cosas distintas no se pisan.
create or replace function public.vitrina_marcar(p_lista text, p_valor text, p_activo boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_local();
  if p_lista = 'sabores' then
    update public.vitrina
       set sabores = case
             when not p_activo then array_remove(sabores, p_valor)
             when p_valor = any (sabores) then sabores
             else array_append(sabores, p_valor)
           end
     where id = 1 and fecha is not null;
  elsif p_lista = 'agotados' then
    update public.vitrina
       set productos_agotados = case
             when not p_activo then array_remove(productos_agotados, p_valor)
             when p_valor = any (productos_agotados) then productos_agotados
             else array_append(productos_agotados, p_valor)
           end
     where id = 1 and fecha is not null;
  else
    raise exception 'lista_invalida';
  end if;
end;
$$;

-- Registra un sabor nuevo; si el día ya abrió, queda disponible de una.
create or replace function public.agregar_sabor_extra(p jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_local();
  update public.vitrina
     set sabores_extra = sabores_extra || jsonb_build_array(p),
         sabores = case
           when fecha is not null and not ((p ->> 'id') = any (sabores))
             then array_append(sabores, p ->> 'id')
           else sabores
         end
   where id = 1
     and not exists (
       select 1 from jsonb_array_elements(sabores_extra) e where e ->> 'id' = p ->> 'id'
     );
end;
$$;

create or replace function public.eliminar_sabor_extra(p_id text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.exigir_local();
  update public.vitrina
     set sabores_extra = coalesce(
           (select jsonb_agg(e) from jsonb_array_elements(sabores_extra) e where e ->> 'id' <> p_id),
           '[]'::jsonb
         ),
         sabores = array_remove(sabores, p_id)
   where id = 1;
end;
$$;

-- Supabase da permiso de ejecutar funciones a anon por defecto: se quita en
-- todas, también en las auxiliares.
revoke execute on function
  public.es_local(),
  public.jornada_actual(),
  public.exigir_local(),
  public.crear_pedido(jsonb),
  public.limpiar_despachados(),
  public.cerrar_caja(uuid, uuid, uuid, timestamptz, jsonb),
  public.entrar(uuid, text, timestamptz),
  public.vitrina_marcar(text, text, boolean),
  public.agregar_sabor_extra(jsonb),
  public.eliminar_sabor_extra(text)
  from public, anon;

grant execute on function
  public.es_local(),
  public.jornada_actual(),
  public.exigir_local(),
  public.crear_pedido(jsonb),
  public.limpiar_despachados(),
  public.cerrar_caja(uuid, uuid, uuid, timestamptz, jsonb),
  public.entrar(uuid, text, timestamptz),
  public.vitrina_marcar(text, text, boolean),
  public.agregar_sabor_extra(jsonb),
  public.eliminar_sabor_extra(text)
  to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Tiempo real: avisar a los celulares cuando cambia algo.
-- ════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime
  add table public.jornada, public.pedidos, public.turnos, public.cierres, public.vitrina;
