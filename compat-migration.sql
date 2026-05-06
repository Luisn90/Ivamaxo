-- Add compatibility columns to products table
alter table products add column if not exists vehicle_brand text;
alter table products add column if not exists compatible_models text;
alter table products add column if not exists compatible_years text;
alter table products add column if not exists engine_codes text;
