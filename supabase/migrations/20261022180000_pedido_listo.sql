-- ════════════════════════════════════════════════════════════════════════════
-- Gelato Alla Crema · estado "listo para recoger"
--
-- Antes: pendiente → despachado.
-- Ahora: pendiente (en preparación) → listo (para recoger) → despachado
-- (entregado en la mesa). Cocina marca "listo" y al mesero que tomó el pedido
-- le llega el aviso para recogerlo.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.pedidos drop constraint pedidos_estado_check;
alter table public.pedidos
  add constraint pedidos_estado_check check (estado in ('pendiente', 'listo', 'despachado'));

alter table public.pedidos add column listo_at timestamptz;
