insert into role_capability_templates (role, scope, capability, updated_at)
select seed.role, seed.scope, seed.capability, now()
from (
  values
    ('admin', 'account', 'inventory.read'),
    ('admin', 'account', 'inventory.manage'),
    ('business', 'account', 'inventory.read'),
    ('business', 'account', 'inventory.manage'),
    ('member', 'account', 'inventory.read')
) as seed(role, scope, capability)
where not exists (
  select 1
  from role_capability_templates existing
  where existing.role = seed.role
    and existing.scope = seed.scope
    and existing.capability = seed.capability
);
