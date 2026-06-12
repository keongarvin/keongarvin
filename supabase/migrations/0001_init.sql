-- Cabin Inventory: schema, RLS, and seed data
-- Apply with `supabase db push` or paste into the Supabase SQL editor.

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references locations(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  quantity int not null default 1,
  category_id uuid references categories(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  expiry_date date,
  restock_below int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_name_idx on items (name);

create table photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table item_photos (
  item_id uuid not null references items(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  primary key (item_id, photo_id)
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  status text not null default 'planning' check (status in ('planning', 'active', 'done')),
  created_at timestamptz not null default now()
);

create table trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  label text,
  action text not null check (action in ('pack', 'bring_home')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS: any authenticated user has full access. Signups are disabled in the
-- Supabase dashboard, so "authenticated" is exactly the household.
alter table people enable row level security;
alter table categories enable row level security;
alter table locations enable row level security;
alter table items enable row level security;
alter table photos enable row level security;
alter table item_photos enable row level security;
alter table trips enable row level security;
alter table trip_items enable row level security;

create policy "household full access" on people for all to authenticated using (true) with check (true);
create policy "household full access" on categories for all to authenticated using (true) with check (true);
create policy "household full access" on locations for all to authenticated using (true) with check (true);
create policy "household full access" on items for all to authenticated using (true) with check (true);
create policy "household full access" on photos for all to authenticated using (true) with check (true);
create policy "household full access" on item_photos for all to authenticated using (true) with check (true);
create policy "household full access" on trips for all to authenticated using (true) with check (true);
create policy "household full access" on trip_items for all to authenticated using (true) with check (true);

-- Private photos bucket + storage policies
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "household photo read" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
create policy "household photo upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "household photo delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- Seed data
insert into people (name) values ('Keon'), ('Claire'), ('Shared');

insert into categories (name, sort_order) values
  ('Food', 1),
  ('Clothes', 2),
  ('Outdoor Gear', 3),
  ('Bikes', 4),
  ('Alcohol', 5),
  ('Kitchen', 6),
  ('Toiletries', 7),
  ('Games', 8),
  ('Tools', 9),
  ('Other', 10);

-- Locations: floor -> room -> area
with main as (
  insert into locations (name, sort_order) values ('Main Floor', 1) returning id
), up as (
  insert into locations (name, sort_order) values ('Upstairs', 2) returning id
), base as (
  insert into locations (name, sort_order) values ('Basement', 3) returning id
), rooms as (
  insert into locations (name, parent_id, sort_order)
  select v.name, v.parent, v.ord from (
    select 'Kitchen' as name, (select id from main) as parent, 1 as ord
    union all select 'Living Room', (select id from main), 2
    union all select 'Main Bathroom', (select id from main), 3
    union all select 'Bedroom 1', (select id from up), 1
    union all select 'Bedroom 2', (select id from up), 2
    union all select 'Bedroom 3', (select id from up), 3
    union all select 'Upstairs Bathroom', (select id from up), 4
    union all select 'Storage Room', (select id from base), 1
    union all select 'Basement Bathroom', (select id from base), 2
  ) v
  returning id, name
)
insert into locations (name, parent_id, sort_order)
select v.name, v.parent, v.ord from (
  select 'Pantry' as name, (select id from rooms where name = 'Kitchen') as parent, 1 as ord
  union all select 'Bedroom 1 Closet', (select id from rooms where name = 'Bedroom 1'), 1
  union all select 'Bedroom 2 Closet', (select id from rooms where name = 'Bedroom 2'), 1
  union all select 'Bedroom 3 Closet', (select id from rooms where name = 'Bedroom 3'), 1
  union all select 'Gear Shelves', (select id from rooms where name = 'Storage Room'), 1
  union all select 'Bike Rack', (select id from rooms where name = 'Storage Room'), 2
) v;
