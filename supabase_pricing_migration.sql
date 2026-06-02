-- ─────────────────────────────────────────────────────────────────────────────
-- Pioneer Job Card App – Pricing & Cashier Role Migration
-- Safe for databases created with Supabase's default bigint IDs.
--
-- Run each numbered block separately in the Supabase SQL Editor if you want
-- to verify each step, or run the whole file at once.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 0. Fix column name mismatches in detail tables ──────────────────────────
-- The setup script used 'job_card_service_line_id' for balancing_details and
-- tyre_repair_details, but the app code uses 'service_line_id' for all three.
-- Also renames tyre_count → number_of_tyres in mounting_details.
do $$
begin
  -- balancing_details: job_card_service_line_id → service_line_id
  if exists (
    select 1 from information_schema.columns
    where table_name = 'balancing_details' and column_name = 'job_card_service_line_id'
  ) then
    alter table balancing_details rename column job_card_service_line_id to service_line_id;
  end if;

  -- tyre_repair_details: job_card_service_line_id → service_line_id
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tyre_repair_details' and column_name = 'job_card_service_line_id'
  ) then
    alter table tyre_repair_details rename column job_card_service_line_id to service_line_id;
  end if;

  -- mounting_details: tyre_count → number_of_tyres
  if exists (
    select 1 from information_schema.columns
    where table_name = 'mounting_details' and column_name = 'tyre_count'
  ) then
    alter table mounting_details rename column tyre_count to number_of_tyres;
  end if;
end $$;


alter table service_catalog
  add column if not exists unit_price numeric(10,2) not null default 0
    check (unit_price >= 0);

-- ─── 2. Add new services ─────────────────────────────────────────────────────
insert into service_catalog (name) values
  ('Tyre Valve'),
  ('Engine Diagnosis')
on conflict (name) do nothing;

-- ─── 3. Flat prices for simple services ──────────────────────────────────────
update service_catalog set unit_price = 30.00  where name = 'Balancing';
update service_catalog set unit_price = 80.00  where name = 'Wheel Alignment';
update service_catalog set unit_price = 40.00  where name = 'Camber';
update service_catalog set unit_price = 50.00  where name = 'Oil Change';
update service_catalog set unit_price = 30.00  where name = 'Car Wash';
update service_catalog set unit_price = 60.00  where name = 'Polish';
update service_catalog set unit_price = 10.00  where name = 'Tyre Valve';
update service_catalog set unit_price = 100.00 where name = 'Engine Diagnosis';
update service_catalog set unit_price = 0      where name = 'Tyre Repair';
update service_catalog set unit_price = 0      where name = 'Mounting';

-- ─── 4. service_price_rules ──────────────────────────────────────────────────
-- This table has NO foreign keys so it works regardless of whether your other
-- tables use uuid or bigint primary keys.
create table if not exists service_price_rules (
  id           bigint primary key generated always as identity,
  service_name text not null,
  rule_key     text not null,
  price        numeric(10,2) not null default 0 check (price >= 0),
  created_at   timestamptz default now(),
  unique (service_name, rule_key)
);

alter table service_price_rules enable row level security;

-- Drop policies first in case this is being re-run
drop policy if exists "spr: auth read"   on service_price_rules;
drop policy if exists "spr: auth insert" on service_price_rules;
drop policy if exists "spr: auth update" on service_price_rules;
drop policy if exists "spr: auth delete" on service_price_rules;

create policy "spr: auth read"   on service_price_rules for select using (auth.role() = 'authenticated');
create policy "spr: auth insert" on service_price_rules for insert with check (auth.role() = 'authenticated');
create policy "spr: auth update" on service_price_rules for update using (auth.role() = 'authenticated');
create policy "spr: auth delete" on service_price_rules for delete using (auth.role() = 'authenticated');

-- ─── 5. Seed price rules ─────────────────────────────────────────────────────

-- Mounting: price per tyre by tyre type
insert into service_price_rules (service_name, rule_key, price) values
  ('Mounting', 'NORMAL', 20.00),
  ('Mounting', 'XL',     25.00)
on conflict (service_name, rule_key) do update set price = excluded.price;

-- Tyre Repair: two repair methods
--   PATCH  — patch size (SMALL / MEDIUM / LARGE) × quantity (number of patches)
--   WETIF  — tubeless wet-if, billed per tyre (quantity)
insert into service_price_rules (service_name, rule_key, price) values
  ('Tyre Repair', 'PATCH_SMALL',  15.00),
  ('Tyre Repair', 'PATCH_MEDIUM', 20.00),
  ('Tyre Repair', 'PATCH_LARGE',  25.00),
  ('Tyre Repair', 'WETIF',        30.00)
on conflict (service_name, rule_key) do update set price = excluded.price;

-- ─── 6. Extend tyre_repair_details for two repair methods ────────────────────
-- Adds: repair_method ('PATCH'|'WETIF'), patch_size ('SMALL'|'MEDIUM'|'LARGE'|null), quantity
-- Keeps: patch_type, patch_count for backward compatibility

-- 6a. Drop old patch_type check constraint and make patch_type nullable
--     (WETIF rows have no patch size, so patch_type must allow null)
alter table tyre_repair_details
  drop constraint if exists tyre_repair_details_patch_type_check;

alter table tyre_repair_details
  alter column patch_type drop not null;

-- 6b. Add new columns (nullable so existing rows are not rejected)
alter table tyre_repair_details
  add column if not exists repair_method text,
  add column if not exists patch_size    text,
  add column if not exists quantity      integer;

-- 6c. Back-fill new columns from existing patch_type / patch_count values
update tyre_repair_details
set
  repair_method = 'PATCH',
  patch_size    = patch_type,
  quantity      = patch_count
where repair_method is null;

-- 6d. Add check constraints now that all rows are filled
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trd_repair_method_check'
  ) then
    alter table tyre_repair_details
      add constraint trd_repair_method_check
        check (repair_method in ('PATCH', 'WETIF'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'trd_patch_size_check'
  ) then
    alter table tyre_repair_details
      add constraint trd_patch_size_check
        check (patch_size in ('SMALL', 'MEDIUM', 'LARGE') or patch_size is null);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'trd_patch_size_required'
  ) then
    alter table tyre_repair_details
      add constraint trd_patch_size_required
        check (
          (repair_method = 'PATCH' and patch_size is not null) or
          (repair_method = 'WETIF' and patch_size is null)
        );
  end if;
end $$;

-- 6e. Make repair_method and quantity not-null (all rows filled above)
alter table tyre_repair_details
  alter column repair_method set not null,
  alter column quantity       set not null;

-- ─── 7. Cashier role ─────────────────────────────────────────────────────────
-- profiles already has a role column (default 'staff').
-- To grant cashier access to a user:
--   update profiles set role = 'cashier' where email = 'cashier@example.com';
--
-- The app enforces read-only access in the UI for cashiers.
-- Optionally add DB-level write protection:
--
-- drop policy if exists "job_cards: auth insert" on job_cards;
-- create policy "job_cards: staff insert" on job_cards
--   for insert with check (
--     auth.role() = 'authenticated' and
--     exists (select 1 from profiles where id = auth.uid() and role = 'staff')
--   );
