-- ============================================================
-- IVAMAXO — Politicas RLS (estado real en produccion)
-- Aplicado: 2026-09-13
--
-- Reemplaza a fix-rls.sql, que dejaba products abierto a escritura
-- publica (cualquiera con la clave anon podia editar o borrar el
-- catalogo completo desde el navegador).
--
-- Principio: la autoridad se resuelve en el servidor. El JS del
-- dashboard nunca decide quien puede escribir; lo decide is_admin().
-- ============================================================

-- ── FUNCION DE ROL ────────────────────────────────────────
-- SECURITY DEFINER evita recursion de RLS al leer profiles
-- desde las propias politicas.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Para dar de alta un admin:
--   update profiles set role='admin' where id='<uuid del usuario>';

-- ── PRODUCTS ──────────────────────────────────────────────
drop policy if exists "read_active_products" on products;
drop policy if exists "write_products"       on products;
drop policy if exists "update_products"      on products;
drop policy if exists "delete_products"      on products;

create policy "products_public_read" on products
  for select using (status = 'active' or public.is_admin());
create policy "products_admin_insert" on products
  for insert with check (public.is_admin());
create policy "products_admin_update" on products
  for update using (public.is_admin()) with check (public.is_admin());
create policy "products_admin_delete" on products
  for delete using (public.is_admin());

-- ── CATEGORIES ────────────────────────────────────────────
drop policy if exists "read_categories"  on categories;
drop policy if exists "write_categories" on categories;

create policy "categories_public_read" on categories
  for select using (true);
create policy "categories_admin_write" on categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ── SETTINGS ──────────────────────────────────────────────
-- Lectura publica a proposito: la tienda necesita global_markup
-- para calcular precios. No guardar claves de API aqui.
drop policy if exists "read_settings"  on settings;
drop policy if exists "write_settings" on settings;

create policy "settings_public_read" on settings
  for select using (true);
create policy "settings_admin_write" on settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ── ORDERS ────────────────────────────────────────────────
-- Antes el admin solo veia sus propios pedidos: el modulo de
-- pedidos del dashboard estaba roto de fabrica.
drop policy if exists "own_orders_select" on orders;
drop policy if exists "own_orders_update" on orders;

create policy "orders_select" on orders
  for select using (auth.uid() = user_id or public.is_admin());
create policy "orders_update" on orders
  for update using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- ── ORDER ITEMS ───────────────────────────────────────────
-- Antes with_check = true: cualquiera podia inyectar items en el
-- pedido de otro cliente.
drop policy if exists "own_order_items"    on order_items;
drop policy if exists "insert_order_items" on order_items;

create policy "order_items_select" on order_items
  for select using (
    public.is_admin() or auth.uid() = (
      select o.user_id from orders o where o.id = order_items.order_id
    )
  );
create policy "order_items_insert" on order_items
  for insert with check (
    public.is_admin() or auth.uid() = (
      select o.user_id from orders o where o.id = order_items.order_id
    )
  );

-- ── PROFILES ──────────────────────────────────────────────
drop policy if exists "own_profile_select" on profiles;
drop policy if exists "own_profile_update" on profiles;

create policy "profiles_select" on profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update" on profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ── ADDRESSES ─────────────────────────────────────────────
drop policy if exists "own_addresses" on addresses;

create policy "addresses_own" on addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "addresses_admin_read" on addresses
  for select using (public.is_admin());
