insert into public.inventory_locations (code, name, is_active) values ('MAIN', 'Main stockroom', true) on conflict (code) do nothing;
