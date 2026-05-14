-- ─────────────────────────────────────────────────────────────────────────────
-- Pioneer Job Card App – Supabase Database Setup
-- Run this in the Supabase SQL Editor for your project.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text default 'staff',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── customers ───────────────────────────────────────────────────────────────
create table if not exists customers (
  id          uuid primary key default uuid_generate_v4(),
  full_name   text not null,
  mobile      text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists customers_mobile_idx on customers(mobile);
create index if not exists customers_full_name_idx on customers(lower(full_name));

-- ─── vehicles ────────────────────────────────────────────────────────────────
create table if not exists vehicles (
  id                  uuid primary key default uuid_generate_v4(),
  customer_id         uuid references customers(id) on delete set null,
  plate_no            text not null,
  make                text,
  model               text,
  year                integer check (year >= 1900 and year <= 2100),
  current_km_reading  numeric check (current_km_reading >= 0),
  tyre_size_front     text,
  tyre_size_rear      text,
  spare_size          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists vehicles_plate_no_idx on vehicles(lower(plate_no));
create index if not exists vehicles_customer_id_idx on vehicles(customer_id);

-- ─── service_catalog ─────────────────────────────────────────────────────────
create table if not exists service_catalog (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  active      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Seed services (add Camber if not present)
insert into service_catalog (name) values
  ('Balancing'),
  ('Wheel Alignment'),
  ('Tyre Repair'),
  ('Mounting'),
  ('Oil Change'),
  ('Car Wash'),
  ('Polish'),
  ('Camber')
on conflict (name) do nothing;

-- ─── job_cards ───────────────────────────────────────────────────────────────
create table if not exists job_cards (
  id              uuid primary key default uuid_generate_v4(),
  job_card_no     text not null unique,
  customer_id     uuid references customers(id) on delete set null,
  vehicle_id      uuid references vehicles(id) on delete set null,
  job_date        date not null default current_date,
  time_in         time,
  time_out        time,
  technician_name text,
  status          text not null default 'OPEN'
                    check (status in ('OPEN','IN_PROGRESS','COMPLETED','CLOSED')),
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists job_cards_job_card_no_idx on job_cards(job_card_no);
create index if not exists job_cards_job_date_idx on job_cards(job_date desc);
create index if not exists job_cards_status_idx on job_cards(status);
create index if not exists job_cards_customer_id_idx on job_cards(customer_id);
create index if not exists job_cards_vehicle_id_idx on job_cards(vehicle_id);

-- ─── job_card_services ───────────────────────────────────────────────────────
create table if not exists job_card_services (
  id                  uuid primary key default uuid_generate_v4(),
  job_card_id         uuid not null references job_cards(id) on delete cascade,
  service_catalog_id  uuid not null references service_catalog(id) on delete cascade,
  unique (job_card_id, service_catalog_id)
);

create index if not exists jcs_job_card_id_idx on job_card_services(job_card_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_customers_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger set_vehicles_updated_at before update on vehicles
  for each row execute function set_updated_at();
create trigger set_job_cards_updated_at before update on job_cards
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles          enable row level security;
alter table customers         enable row level security;
alter table vehicles          enable row level security;
alter table service_catalog   enable row level security;
alter table job_cards         enable row level security;
alter table job_card_services enable row level security;

-- profiles: users can read/update their own profile
create policy "profiles: own read"   on profiles for select using (auth.uid() = id);
create policy "profiles: own update" on profiles for update using (auth.uid() = id);

-- Authenticated users can read and write all workshop data
create policy "customers: auth read"   on customers for select using (auth.role() = 'authenticated');
create policy "customers: auth insert" on customers for insert with check (auth.role() = 'authenticated');
create policy "customers: auth update" on customers for update using (auth.role() = 'authenticated');

create policy "vehicles: auth read"   on vehicles for select using (auth.role() = 'authenticated');
create policy "vehicles: auth insert" on vehicles for insert with check (auth.role() = 'authenticated');
create policy "vehicles: auth update" on vehicles for update using (auth.role() = 'authenticated');

create policy "service_catalog: auth read" on service_catalog for select using (auth.role() = 'authenticated');

create policy "job_cards: auth read"   on job_cards for select using (auth.role() = 'authenticated');
create policy "job_cards: auth insert" on job_cards for insert with check (auth.role() = 'authenticated');
create policy "job_cards: auth update" on job_cards for update using (auth.role() = 'authenticated');

create policy "job_card_services: auth read"   on job_card_services for select using (auth.role() = 'authenticated');
create policy "job_card_services: auth insert" on job_card_services for insert with check (auth.role() = 'authenticated');
create policy "job_card_services: auth delete" on job_card_services for delete using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- Service Detail Tables  (run after initial setup if upgrading)
-- ─────────────────────────────────────────────────────────────────────────────

-- Add Camber to service catalog if upgrading an existing project
insert into service_catalog (name) values ('Camber') on conflict (name) do nothing;

-- ─── job_card_balancing_rows ─────────────────────────────────────────────────
-- One row per tyre worked on during a balancing service.
create table if not exists job_card_balancing_rows (
  id             uuid primary key default uuid_generate_v4(),
  job_card_id    uuid not null references job_cards(id) on delete cascade,
  tyre_position  text not null check (tyre_position in ('FL','FR','RL','RR','SPARE')),
  grams_used     numeric not null check (grams_used >= 0),
  sort_order     integer not null default 0,
  created_at     timestamptz default now()
);
create index if not exists jcbr_job_card_id_idx on job_card_balancing_rows(job_card_id);

alter table job_card_balancing_rows enable row level security;
create policy "jcbr: auth read"   on job_card_balancing_rows for select using (auth.role() = 'authenticated');
create policy "jcbr: auth insert" on job_card_balancing_rows for insert with check (auth.role() = 'authenticated');
create policy "jcbr: auth delete" on job_card_balancing_rows for delete using (auth.role() = 'authenticated');

-- ─── job_card_tyre_repair_rows ───────────────────────────────────────────────
-- One row per tyre repaired.
create table if not exists job_card_tyre_repair_rows (
  id             uuid primary key default uuid_generate_v4(),
  job_card_id    uuid not null references job_cards(id) on delete cascade,
  tyre_position  text not null check (tyre_position in ('FL','FR','RL','RR','SPARE')),
  patch_type     text not null check (patch_type in ('SMALL','MEDIUM','LARGE')),
  patch_count    integer not null check (patch_count >= 1),
  sort_order     integer not null default 0,
  created_at     timestamptz default now()
);
create index if not exists jctrr_job_card_id_idx on job_card_tyre_repair_rows(job_card_id);

alter table job_card_tyre_repair_rows enable row level security;
create policy "jctrr: auth read"   on job_card_tyre_repair_rows for select using (auth.role() = 'authenticated');
create policy "jctrr: auth insert" on job_card_tyre_repair_rows for insert with check (auth.role() = 'authenticated');
create policy "jctrr: auth delete" on job_card_tyre_repair_rows for delete using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- V2 Submission Model  –  run this block to migrate to service lines
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── job_card_service_lines ──────────────────────────────────────────────────
-- Replaces job_card_services.
-- One row per selected service on a job card.
-- quantity = number of items worked on (tyres balanced, tyres repaired, etc.)
-- For services with no detail (Oil Change, Car Wash, etc.) quantity defaults to 1.
create table if not exists job_card_service_lines (
  id                  uuid primary key default uuid_generate_v4(),
  job_card_id         uuid not null references job_cards(id) on delete cascade,
  service_catalog_id  uuid not null references service_catalog(id) on delete cascade,
  quantity            integer not null default 1 check (quantity >= 1),
  sort_order          integer not null default 0,
  created_at          timestamptz default now(),
  unique (job_card_id, service_catalog_id)
);
create index if not exists jcsl_job_card_id_idx on job_card_service_lines(job_card_id);

alter table job_card_service_lines enable row level security;
create policy "jcsl: auth read"   on job_card_service_lines for select using (auth.role() = 'authenticated');
create policy "jcsl: auth insert" on job_card_service_lines for insert with check (auth.role() = 'authenticated');
create policy "jcsl: auth delete" on job_card_service_lines for delete using (auth.role() = 'authenticated');
create policy "jcsl: auth update" on job_card_service_lines for update using (auth.role() = 'authenticated');

-- ─── Drop old direct-to-job-card detail tables and recreate linked to service line ──

drop table if exists job_card_balancing_rows;
drop table if exists job_card_tyre_repair_rows;

-- ─── balancing_details ───────────────────────────────────────────────────────
-- Child of job_card_service_lines (the Balancing line).
create table if not exists balancing_details (
  id                      uuid primary key default uuid_generate_v4(),
  job_card_service_line_id uuid not null references job_card_service_lines(id) on delete cascade,
  tyre_position           text not null check (tyre_position in ('FL','FR','RL','RR','SPARE')),
  grams_used              numeric not null check (grams_used >= 0),
  sort_order              integer not null default 0,
  created_at              timestamptz default now()
);
create index if not exists bd_service_line_id_idx on balancing_details(job_card_service_line_id);

alter table balancing_details enable row level security;
create policy "bd: auth read"   on balancing_details for select using (auth.role() = 'authenticated');
create policy "bd: auth insert" on balancing_details for insert with check (auth.role() = 'authenticated');
create policy "bd: auth delete" on balancing_details for delete using (auth.role() = 'authenticated');

-- ─── tyre_repair_details ─────────────────────────────────────────────────────
-- Child of job_card_service_lines (the Tyre Repair line).
create table if not exists tyre_repair_details (
  id                      uuid primary key default uuid_generate_v4(),
  job_card_service_line_id uuid not null references job_card_service_lines(id) on delete cascade,
  tyre_position           text not null check (tyre_position in ('FL','FR','RL','RR','SPARE')),
  patch_type              text not null check (patch_type in ('SMALL','MEDIUM','LARGE')),
  patch_count             integer not null check (patch_count >= 1),
  sort_order              integer not null default 0,
  created_at              timestamptz default now()
);
create index if not exists trd_service_line_id_idx on tyre_repair_details(job_card_service_line_id);

alter table tyre_repair_details enable row level security;
create policy "trd: auth read"   on tyre_repair_details for select using (auth.role() = 'authenticated');
create policy "trd: auth insert" on tyre_repair_details for insert with check (auth.role() = 'authenticated');
create policy "trd: auth delete" on tyre_repair_details for delete using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- Mounting Details  (add this table if not already present)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists mounting_details (
  id               uuid primary key default uuid_generate_v4(),
  service_line_id  uuid not null references job_card_service_lines(id) on delete cascade,
  tyre_count       integer not null check (tyre_count >= 1),
  tyre_type        text not null check (tyre_type in ('NORMAL', 'XL')),
  created_at       timestamptz default now()
);
create index if not exists md_service_line_id_idx on mounting_details(service_line_id);

alter table mounting_details enable row level security;
create policy "md: auth read"   on mounting_details for select using (auth.role() = 'authenticated');
create policy "md: auth insert" on mounting_details for insert with check (auth.role() = 'authenticated');
create policy "md: auth delete" on mounting_details for delete using (auth.role() = 'authenticated');
