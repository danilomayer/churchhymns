-- Cole no SQL Editor do Supabase e execute uma vez.
create table if not exists domingos (
  dia date primary key,
  hinos jsonb not null,
  atualizado_em timestamptz default now()
);

alter table domingos enable row level security;

create policy "ler"       on domingos for select using (true);
create policy "inserir"   on domingos for insert with check (true);
create policy "atualizar" on domingos for update using (true) with check (true);
create policy "apagar"    on domingos for delete using (true);
