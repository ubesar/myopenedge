create table public.mc_alert_state (
  id int primary key check (id = 1),
  last_alert_time text not null default '',
  last_signal_type text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.mc_alert_state (id) values (1);

alter table public.mc_alert_state enable row level security;