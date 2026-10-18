-- Rotador de WhatsApp para la landing Red Green.
-- Correr una sola vez en Supabase > SQL Editor.
-- La tabla NO tiene policies: solo se accede desde las funciones de Vercel
-- con la service_role key (nunca desde el navegador).

create table if not exists public.wa_numeros (
  id bigint generated always as identity primary key,
  landing_id text not null,
  numero text not null,
  nombre text,
  activo boolean not null default true,
  clicks integer not null default 0,
  last_used timestamptz,
  created_at timestamptz not null default now(),
  unique (landing_id, numero)
);

alter table public.wa_numeros enable row level security;

-- Devuelve el proximo numero activo (el que hace mas tiempo no recibe un clic)
-- y le suma el clic, de forma atomica: dos clics simultaneos no caen en el mismo numero.
create or replace function public.next_wa_numero(p_landing text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  update wa_numeros
     set clicks = clicks + 1,
         last_used = now()
   where id = (
     select id from wa_numeros
      where landing_id = p_landing and activo
      order by last_used asc nulls first, id
      limit 1
      for update skip locked
   )
  returning numero into v;
  return v;
end;
$$;

revoke execute on function public.next_wa_numero(text) from public, anon, authenticated;
grant execute on function public.next_wa_numero(text) to service_role;

insert into public.wa_numeros (landing_id, numero, nombre) values
  ('redgreen', '5491133633742', 'Agente 1'),
  ('redgreen', '5491133633748', 'Agente 2'),
  ('redgreen', '5491133633847', 'Agente 3'),
  ('redgreen', '5491176243646', 'Agente 4'),
  ('redgreen', '5493548591305', 'Agente 5'),
  ('redgreen', '5493548603069', 'Agente 6'),
  ('redgreen', '5493548616968', 'Agente 7')
on conflict (landing_id, numero) do nothing;
