-- ═══════════════════════════════════════════
--  IVAMAXO — Supabase Database Setup
-- ═══════════════════════════════════════════

-- Extensions
create extension if not exists "uuid-ossp";

-- ── CATEGORIES ──────────────────────────────
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  icon text,
  created_at timestamp with time zone default now()
);

-- ── PRODUCTS ────────────────────────────────
create table products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  brand text not null,
  category_id uuid references categories(id),
  price decimal(10,2) not null,
  old_price decimal(10,2),
  stock int default 0,
  sku text unique,
  description text,
  badge text,
  badge_text text,
  status text default 'active' check (status in ('active','draft','hidden')),
  featured boolean default false,
  icon text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ── PROFILES (clientes) ─────────────────────
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  phone text,
  avatar_url text,
  role text default 'customer' check (role in ('customer','admin')),
  created_at timestamp with time zone default now()
);

-- ── ADDRESSES ───────────────────────────────
create table addresses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text default 'Casa',
  street text not null,
  city text not null,
  state text,
  country text default 'Venezuela',
  is_default boolean default false,
  created_at timestamp with time zone default now()
);

-- ── ORDERS ──────────────────────────────────
create table orders (
  id uuid default uuid_generate_v4() primary key,
  order_number text unique not null,
  user_id uuid references auth.users(id),
  status text default 'pending' check (status in ('pending','processing','shipped','delivered','cancelled')),
  total decimal(10,2) not null,
  address_id uuid references addresses(id),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ── ORDER ITEMS ─────────────────────────────
create table order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  product_brand text not null,
  quantity int not null,
  price decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

-- ── WISHLIST ─────────────────────────────────
create table wishlist (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(user_id, product_id)
);

-- ═══════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════

alter table categories  enable row level security;
alter table products    enable row level security;
alter table profiles    enable row level security;
alter table addresses   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table wishlist    enable row level security;

-- Público puede leer productos y categorías
create policy "public_read_categories" on categories for select using (true);
create policy "public_read_products"   on products   for select using (status = 'active');

-- Admin puede hacer todo en productos y categorías
create policy "admin_all_products"    on products    for all using (true) with check (true);
create policy "admin_all_categories"  on categories  for all using (true) with check (true);

-- Perfiles
create policy "own_profile_select" on profiles for select using (auth.uid() = id);
create policy "own_profile_insert" on profiles for insert with check (auth.uid() = id);
create policy "own_profile_update" on profiles for update using (auth.uid() = id);

-- Direcciones
create policy "own_addresses" on addresses for all using (auth.uid() = user_id);

-- Pedidos
create policy "own_orders_select" on orders for select using (auth.uid() = user_id);
create policy "own_orders_insert" on orders for insert with check (auth.uid() = user_id);
create policy "own_orders_update" on orders for update using (auth.uid() = user_id);

-- Items del pedido
create policy "own_order_items" on order_items for select using (
  auth.uid() = (select user_id from orders where id = order_id)
);
create policy "insert_order_items" on order_items for insert with check (true);

-- Wishlist
create policy "own_wishlist" on wishlist for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════
--  TRIGGER: crear perfil al registrarse
-- ═══════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ═══════════════════════════════════════════
--  FUNCIÓN: número de orden automático
-- ═══════════════════════════════════════════

create or replace function generate_order_number()
returns text as $$
begin
  return 'IVA-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random()*9000+1000)::text, 4, '0');
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════
--  DATOS INICIALES
-- ═══════════════════════════════════════════

insert into categories (name, slug, icon) values
  ('Encendido',  'encendido',   'spark'),
  ('Filtros',    'filtros',     'filter'),
  ('Lubricantes','lubricantes', 'oil'),
  ('Frenos',     'frenos',      'brake'),
  ('Suspensión', 'suspension',  'shock'),
  ('Eléctrico',  'electrico',   'battery'),
  ('Carrocería', 'carroceria',  'body'),
  ('Neumáticos', 'neumaticos',  'tire');

insert into products (name,brand,category_id,price,old_price,stock,sku,badge,badge_text,status,featured,icon)
select 'Bujía Iridium IX','NGK',id,18.99,24.99,43,'NGK-BKR6EIX','bn','Top venta','active',true,'spark'
from categories where slug='encendido';

insert into products (name,brand,category_id,price,stock,sku,status,featured,icon)
select 'Filtro de Aceite','Bosch',id,8.50,28,'BSH-F026','active',true,'filter'
from categories where slug='filtros';

insert into products (name,brand,category_id,price,old_price,stock,sku,badge,badge_text,status,featured,icon)
select 'Aceite 5W-30 4L','Castrol',id,28.90,39.90,15,'CST-5W30-4L','bs','28% OFF','active',true,'oil'
from categories where slug='lubricantes';

insert into products (name,brand,category_id,price,stock,sku,badge,badge_text,status,featured,icon)
select 'Pastillas de Freno','Brembo',id,45.00,0,'BRM-P85020','bh','Destacado','active',true,'brake'
from categories where slug='frenos';

insert into products (name,brand,category_id,price,old_price,stock,sku,badge,badge_text,status,icon)
select 'Amortiguador Eccel','Monroe',id,62.00,79.00,6,'MON-G8114','bn','Nuevo','draft','shock'
from categories where slug='suspension';

insert into products (name,brand,category_id,price,stock,sku,status,featured,icon)
select 'Filtro de Aire','Mahle',id,12.50,32,'MHL-LX1920','active',false,'airfilter'
from categories where slug='filtros';

insert into products (name,brand,category_id,price,old_price,stock,sku,badge,badge_text,status,featured,icon)
select 'Batería AGM 60Ah','Bosch',id,89.00,110.00,0,'BSH-S5A05','bs','19% OFF','active',true,'battery'
from categories where slug='electrico';

insert into products (name,brand,category_id,price,stock,sku,badge,badge_text,status,icon)
select 'Correa Distribución','Gates',id,35.90,9,'GTS-K015613XS','bn','Nuevo','active','belt'
from categories where slug='encendido';
