-- Script para corrigir o problema de autenticação
-- Execute este script no painel SQL do Supabase

-- 1. Primeiro, verificar se o trigger existe e recriá-lo
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 2. Recriar a função com tratamento de erros melhor
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Verificar se o usuário já existe antes de inserir
  if not exists (select 1 from public.users where id = new.id) then
    insert into public.users (id, email)
    values (new.id, new.email);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 3. Recriar o trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Verificar usuários existentes que não estão na tabela users
-- (opcional - para corrigir dados existentes)
insert into public.users (id, email)
select id, email 
from auth.users 
where id not in (select id from public.users);
