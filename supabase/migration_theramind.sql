create extension if not exists "uuid-ossp";

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.users enable row level security;

create table public.patients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.patients enable row level security;

create table public.sessions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  audio_url text,
  transcription text,
  summary text,
  insights text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.sessions enable row level security;

create policy "select own user"
  on public.users for select
  using (auth.uid() = id);

create policy "update own user"
  on public.users for update
  using (auth.uid() = id);

create policy "select own patients"
  on public.patients for select
  using (auth.uid() = user_id);

create policy "insert own patients"
  on public.patients for insert
  with check (auth.uid() = user_id);

create policy "update own patients"
  on public.patients for update
  using (auth.uid() = user_id);

create policy "delete own patients"
  on public.patients for delete
  using (auth.uid() = user_id);

create policy "select sessions via own patients"
  on public.sessions for select
  using (
    exists (
      select 1
      from public.patients p
      where p.id = sessions.patient_id
        and p.user_id = auth.uid()
    )
  );

create policy "insert sessions via own patients"
  on public.sessions for insert
  with check (
    exists (
      select 1
      from public.patients p
      where p.id = patient_id
        and p.user_id = auth.uid()
    )
  );

create policy "update sessions via own patients"
  on public.sessions for update
  using (
    exists (
      select 1
      from public.patients p
      where p.id = sessions.patient_id
        and p.user_id = auth.uid()
    )
  );

create policy "delete sessions via own patients"
  on public.sessions for delete
  using (
    exists (
      select 1
      from public.patients p
      where p.id = sessions.patient_id
        and p.user_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();