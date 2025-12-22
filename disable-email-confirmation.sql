-- Script para desativar confirmação de email no Supabase
-- Execute este script no painel SQL do Supabase para resolver o problema de login

-- 1. Desativar confirmação de email para novos usuários
-- Isso pode ser feito através das configurações do Supabase Authentication:
-- Vá para Authentication > Settings > Enable email confirmations = OFF

-- 2. Ativar automaticamente usuários existentes que não estão confirmados
update auth.users 
set email_confirmed_at = now() 
where email_confirmed_at is null;

-- 3. Verificar se há usuários não confirmados
select id, email, created_at, email_confirmed_at
from auth.users 
where email_confirmed_at is null;

-- 4. Opcional: Recriar o trigger para garantir que novos usuários sejam criados na tabela public.users
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Corrigir usuários existentes que não estão na tabela users
insert into public.users (id, email)
select id, email 
from auth.users 
where id not in (select id from public.users);
