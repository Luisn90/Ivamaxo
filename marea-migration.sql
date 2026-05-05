-- ── MIGRATION: Marea import ──

-- 1. Add columns to products for cost price tracking
alter table products add column if not exists cost_price numeric(10,2);
alter table products add column if not exists markup_override numeric(5,2); -- individual markup %
alter table products add column if not exists origen text;
alter table products add column if not exists oem text;
alter table products add column if not exists supplier text default 'MAREA';

-- 2. Settings table for global markup
create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default now()
);

-- Insert default global markup: 30%
insert into settings (key, value) values ('global_markup', '30')
on conflict (key) do nothing;

-- 3. RLS for settings
alter table settings enable row level security;
create policy "read_settings" on settings for select using (true);
create policy "write_settings" on settings for all using (true) with check (true);

-- 4. Add missing categories if not exist
insert into categories (name, slug, icon) values
  ('Correas',       'correas',      'belt'),
  ('Juntas y Sellos','juntas',      'filter'),
  ('Enfriamiento',  'enfriamiento', 'filter'),
  ('Accesorios',    'accesorios',   'default')
on conflict (slug) do nothing;
