-- ════════════════════════════════════════════════════════════════════════════
-- Gelato Alla Crema · la misma gente de la mesa pide algo más
--
-- En vez de abrir otro pedido para la misma mesa, lo nuevo se agrega al que ya
-- tienen (la app pregunta antes: "¿es la misma gente o gente nueva?"):
--   · Lo ya entregado queda marcado en cada línea (entregadaAt, en ms) para
--     tacharlo en la tarjeta; lo que estaba listo sin entregar, listaAt.
--   · El pedido vuelve a "pendiente" y a la cola con la hora de la ronda.
--   · La nota de la ronda nueva se suma a la que ya tenía.
--   · El cobro se recalcula: lo que ya pagaron queda en `abonado` y lo nuevo
--     se suma a lo que deben (o a lo pagado, si lo pagan de una).
--
-- Es la misma regla que el reducer de la app (src/sync/estado.js,
-- 'agregarAPedido'); la prueba de integración compara los dos.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.pedidos
  add column abonado   integer check (abonado is null or abonado > 0),
  add column ronda_at  timestamptz,
  add column ronda_por text;

-- Milisegundos desde 1970, como guarda la app las horas dentro de las líneas.
create or replace function public.a_ms(t timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select floor(extract(epoch from t) * 1000)::bigint
$$;

-- Corre con los permisos de quien llama: las reglas de pedidos aplican (el
-- personal solo toca los del día). Idempotente: si las líneas ya están (la
-- cola reintentó), devuelve el pedido como está.
create or replace function public.agregar_al_pedido(
  p_id     uuid,
  p_lineas jsonb,
  p_monto  integer,
  p_pagado boolean,
  p_at     timestamptz,
  p_por    text,
  p_nota   text default ''
)
returns public.pedidos
language plpgsql
set search_path = ''
as $$
declare
  p        public.pedidos;
  previas  jsonb;
  ya_pagado integer;
  v_total  integer;
  v_abonado integer;
  v_pagado boolean;
begin
  perform public.exigir_local();
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'sin_lineas';
  end if;
  if p_monto < 0 then
    raise exception 'monto_invalido';
  end if;

  select * into p from public.pedidos where id = p_id for update;
  if not found then
    raise exception 'pedido_no_existe';
  end if;
  if p.anulado_at is not null then
    return p;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p.lineas) l where l ->> 'uid' = p_lineas -> 0 ->> 'uid'
  ) then
    return p;
  end if;

  if p.estado = 'despachado' then
    select coalesce(jsonb_agg(
             case when coalesce(l -> 'entregadaAt', 'null'::jsonb) <> 'null'::jsonb then l
                  else l || jsonb_build_object('entregadaAt', public.a_ms(coalesce(p.despachado_at, p_at)))
             end order by n), '[]'::jsonb)
      into previas
      from jsonb_array_elements(p.lineas) with ordinality as t(l, n);
  elsif p.estado = 'listo' then
    select coalesce(jsonb_agg(
             case when coalesce(l -> 'entregadaAt', 'null'::jsonb) <> 'null'::jsonb
                    or coalesce(l -> 'listaAt', 'null'::jsonb) <> 'null'::jsonb then l
                  else l || jsonb_build_object('listaAt', public.a_ms(coalesce(p.listo_at, p_at)))
             end order by n), '[]'::jsonb)
      into previas
      from jsonb_array_elements(p.lineas) with ordinality as t(l, n);
  else
    previas := p.lineas;
  end if;

  ya_pagado := case when p.pagado then p.total else coalesce(p.abonado, 0) end;
  v_total   := p.total + p_monto;
  v_abonado := ya_pagado + case when p_pagado then p_monto else 0 end;
  v_pagado  := v_abonado >= v_total;

  update public.pedidos
     set lineas        = previas || p_lineas,
         nota          = concat_ws(' · ', nullif(p.nota, ''), nullif(p_nota, '')),
         total         = v_total,
         estado        = 'pendiente',
         listo_at      = null,
         despachado_at = null,
         oculto        = false,
         ronda_at      = p_at,
         ronda_por     = p_por,
         pagado        = v_pagado,
         pagado_at     = case when v_pagado then coalesce(p.pagado_at, p_at) else null end,
         abonado       = case when v_pagado or v_abonado = 0 then null else v_abonado end
   where id = p_id
   returning * into p;
  return p;
end;
$$;

revoke execute on function
  public.a_ms(timestamptz),
  public.agregar_al_pedido(uuid, jsonb, integer, boolean, timestamptz, text, text)
  from public, anon;

grant execute on function
  public.a_ms(timestamptz),
  public.agregar_al_pedido(uuid, jsonb, integer, boolean, timestamptz, text, text)
  to authenticated;
