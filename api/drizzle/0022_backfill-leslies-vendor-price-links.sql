update product_vendor_prices as pvp
set
  vendor_sku = coalesce(pvp.vendor_sku, 'CH520'),
  product_url = coalesce(pvp.product_url, 'https://lesliespool.com/champion-acidblue-low-fume-muriatic-acid-1-gallon/14258.html'),
  source = case
    when pvp.source = 'manual' then 'external'
    else pvp.source
  end
from vendors v
cross join products p
where
  p.product_id = pvp.product_id
  and pvp.vendor_id = v.vendor_id
  and v.slug = 'leslies'
  and lower(trim(p.name)) = 'champion muriatic acid';
