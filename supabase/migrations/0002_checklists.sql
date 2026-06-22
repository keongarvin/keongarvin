-- Completeness checklists: a named "what I want here" list with target counts.
-- Coverage / health bars are computed client-side by matching entries against
-- current inventory (optionally scoped to the checklist's location/person).

create table checklists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_id uuid references locations(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  name text not null,
  target_quantity int not null default 1,
  category_id uuid references categories(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index checklist_items_checklist_idx on checklist_items (checklist_id);

alter table checklists enable row level security;
alter table checklist_items enable row level security;

create policy "household full access" on checklists for all to authenticated using (true) with check (true);
create policy "household full access" on checklist_items for all to authenticated using (true) with check (true);
