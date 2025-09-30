-- Basis
create extension if not exists "pgcrypto";

-- Nutzerprofil (1:1 zu auth.users)
create table public.profiles (
  id uuid primary key default auth.uid(),
  email text unique,
  full_name text,
  role text check (role in (
    'user',
    'admin'
  )) default 'user',
  created_at timestamptz default now()
);

-- Claim (Schadenfall)
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  claim_number text unique, -- generiert per Trigger
  date_of_loss timestamptz not null,
  claim_type text not null check (claim_type in (
    'kasko',
    'haftpflicht',
    'teilkasko',
    'unbekannt'
  )),
  description text,
  location jsonb, -- {address, lat, lng}
  vehicle_id uuid references public.vehicles(id),
  third_party_involved boolean default false,
  status text not null check (status in (
    'draft',
    'submitted',
    'in_review',
    'closed'
  )) default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Fahrzeug (optional vorab anlegbar)
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id),
  vin text,
  license_plate text, -- Nummernschild
  make text,
  model text,
  model_year int,
  mileage int,
  usage text check (usage in (
    'privat',
    'dienstlich',
    'gemischt'
  )) default 'privat',
  created_at timestamptz default now()
);

-- Beteiligte (Gegner, Zeugen, Polizei)
create table public.claim_parties (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  role text check (role in (
    'insured',
    'third_party',
    'witness',
    'police'
  )) not null,
  name text,
  phone text,
  email text,
  address jsonb, -- {street, zip, city, country}
  insurance_company text
);

-- Schäden/Positionen
create table public.damages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  area text, -- z.B. "Front links" (frei oder später enum)
  severity text check (severity in (
    'gering',
    'mittel',
    'hoch'
  )) default 'mittel',
  description text,
  drivable boolean,
  estimated_cost numeric(12, 2)
);

-- Dokumente/Fotos (Storage-Verknüpfung)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  file_path text not null, -- Pfad im Storage
  file_type text, -- 'image/jpeg','application/pdf',...
  exif jsonb,
  uploaded_at timestamptz default now()
);

-- Status-Historie
create table public.claim_status_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  status text not null check (status in (
    'draft',
    'submitted',
    'in_review',
    'closed'
  )),
  changed_by uuid references public.profiles(id),
  changed_at timestamptz default now(),
  note text
);

-- Notizen (intern)
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  author_id uuid references public.profiles(id),
  content text not null,
  created_at timestamptz default now()
);

-- Claim-Nummer per Trigger generieren
create or replace function public.gen_claim_number() returns trigger as $$
declare
  v text;
begin
  loop
    v := to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (
      select
        1
      from
        public.claims
      where
        claim_number = v
    );
  end loop;
  new.claim_number := coalesce(new.claim_number, v);
  return new;
end;
$$ language plpgsql;

create trigger trg_claim_number
before
  insert on public.claims for each row
execute
  procedure public.gen_claim_number();

-- Updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_claims_updated
before
  update on public.claims for each row
execute
  procedure public.set_updated_at();

-- RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.claims enable row level security;
alter table public.vehicles enable row level security;
alter table public.claim_parties enable row level security;
alter table public.damages enable row level security;
alter table public.documents enable row level security;
alter table public.claim_status_history enable row level security;
alter table public.notes enable row level security;

-- Profile: Nutzer sieht nur sich selbst
create policy "own profile" on public.profiles for
select
  using (id = auth.uid());

-- Claims: Owner (oder Admin) sieht/bearbeitet
create policy "select own claims" on public.claims for
select
  using (
    owner_id = auth.uid()
    or exists (
      select
        1
      from
        public.profiles p
      where
        p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create policy "insert own claims" on public.claims for insert
with
  check (owner_id = auth.uid());

create policy "update own claims" on public.claims for
update
  using (owner_id = auth.uid());

-- Child-Tabellen: Zugriff via Claim-Besitz
create policy "select via claim owner" on public.claim_parties for
select
  using (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "modify via claim owner" on public.claim_parties for all using (
  exists (
    select
      1
    from
      public.claims c
    where
      c.id = claim_id
      and (c.owner_id = auth.uid())
  )
)
with
  check (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

-- Gleiches Muster für damages, documents, notes, claim_status_history...
create policy "select via claim owner" on public.damages for
select
  using (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "modify via claim owner" on public.damages for all using (
  exists (
    select
      1
    from
      public.claims c
    where
      c.id = claim_id
      and (c.owner_id = auth.uid())
  )
)
with
  check (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "select via claim owner" on public.documents for
select
  using (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "modify via claim owner" on public.documents for all using (
  exists (
    select
      1
    from
      public.claims c
    where
      c.id = claim_id
      and (c.owner_id = auth.uid())
  )
)
with
  check (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "select via claim owner" on public.notes for
select
  using (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "modify via claim owner" on public.notes for all using (
  exists (
    select
      1
    from
      public.claims c
    where
      c.id = claim_id
      and (c.owner_id = auth.uid())
  )
)
with
  check (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "select via claim owner" on public.claim_status_history for
select
  using (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

create policy "modify via claim owner" on public.claim_status_history for all using (
  exists (
    select
      1
    from
      public.claims c
    where
      c.id = claim_id
      and (c.owner_id = auth.uid())
  )
)
with
  check (
    exists (
      select
        1
      from
        public.claims c
      where
        c.id = claim_id
        and (c.owner_id = auth.uid())
    )
  );

-- Storage-Bucket & Policies
-- storage.objects RLS aktivieren (im Supabase-UI)
-- Policy-Beispiel (lesen/schreiben nur wenn Claim dem Nutzer gehört)
create policy "read own files" on storage.objects for
select
  using (
    bucket_id = 'claim-files'
    and exists (
      select
        1
      from
        public.documents d
        join public.claims c on c.id = d.claim_id
      where
        d.file_path = storage.object_name(objects.bucket_id, objects.name)
        and c.owner_id = auth.uid()
    )
  );

create policy "insert own files" on storage.objects for insert
with
  check (
    bucket_id = 'claim-files'
    and exists (
      select
        1
      from
        public.claims c
      where
        (objects.name like ('claims/' || c.id :: text || '/%'))
        and c.owner_id = auth.uid()
    )
  );
