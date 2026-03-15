export const PRODUCT_ITEM_CLASSES = ['chemical', 'supply'] as const;

export type ProductItemClass = (typeof PRODUCT_ITEM_CLASSES)[number];

export const CHEMICAL_PRODUCT_TYPES = [
  'liquid_chlorine',
  'cal_hypo_shock',
  'dichlor_shock',
  'trichlor_tabs',
  'bromine_tabs',
  'bromine_granular',
  'muriatic_acid',
  'dry_acid',
  'soda_ash',
  'baking_soda',
  'calcium_hardness_increaser',
  'stabilizer',
  'salt',
  'non_chlorine_shock',
  'algaecide',
  'clarifier',
  'flocculant',
  'phosphate_remover',
  'metal_sequestrant',
  'enzyme',
  'stain_scale_treatment',
  'filter_cleaner',
  'tile_surface_cleaner',
  'specialty_other',
] as const;

export type ChemicalProductType = (typeof CHEMICAL_PRODUCT_TYPES)[number];

export const SUPPLY_PRODUCT_TYPES = [
  'filter_cartridge',
  'filter_grid_set',
  'skimmer_net',
  'wall_brush',
  'telescoping_pole',
  'vacuum_head',
  'vacuum_hose',
  'test_strip_pack',
  'reagent_refill',
  'basket',
  'o_ring_seal',
  'cleaner_part',
  'specialty_supply',
] as const;

export type SupplyProductType = (typeof SUPPLY_PRODUCT_TYPES)[number];

export const CATALOG_PRODUCT_TYPES = [...CHEMICAL_PRODUCT_TYPES, ...SUPPLY_PRODUCT_TYPES] as const;

export type CatalogProductType = (typeof CATALOG_PRODUCT_TYPES)[number];

export const CHEMICAL_FORMS = [
  'liquid',
  'granular',
  'tablet',
  'powder',
  'crystal',
  'gel',
  'stick',
  'cartridge',
  'specialty_other',
] as const;

export type ChemicalForm = (typeof CHEMICAL_FORMS)[number];

export const CHEMICAL_PRODUCT_TYPE_LABELS: Record<ChemicalProductType, string> = {
  liquid_chlorine: 'Liquid Chlorine',
  cal_hypo_shock: 'Cal-Hypo Shock',
  dichlor_shock: 'Dichlor Shock',
  trichlor_tabs: 'Trichlor Tabs',
  bromine_tabs: 'Bromine Tabs',
  bromine_granular: 'Bromine Granular',
  muriatic_acid: 'Muriatic Acid',
  dry_acid: 'Dry Acid',
  soda_ash: 'Soda Ash',
  baking_soda: 'Baking Soda',
  calcium_hardness_increaser: 'Calcium Hardness Increaser',
  stabilizer: 'Stabilizer / Conditioner',
  salt: 'Salt',
  non_chlorine_shock: 'Non-Chlorine Shock',
  algaecide: 'Algaecide',
  clarifier: 'Clarifier',
  flocculant: 'Flocculant',
  phosphate_remover: 'Phosphate Remover',
  metal_sequestrant: 'Metal Sequestrant',
  enzyme: 'Enzyme Treatment',
  stain_scale_treatment: 'Stain / Scale Treatment',
  filter_cleaner: 'Filter Cleaner',
  tile_surface_cleaner: 'Tile / Surface Cleaner',
  specialty_other: 'Specialty / Other',
};

export const SUPPLY_PRODUCT_TYPE_LABELS: Record<SupplyProductType, string> = {
  filter_cartridge: 'Filter Cartridge',
  filter_grid_set: 'Filter Grid Set',
  skimmer_net: 'Skimmer Net',
  wall_brush: 'Wall Brush',
  telescoping_pole: 'Telescoping Pole',
  vacuum_head: 'Vacuum Head',
  vacuum_hose: 'Vacuum Hose',
  test_strip_pack: 'Test Strip Pack',
  reagent_refill: 'Reagent Refill',
  basket: 'Basket',
  o_ring_seal: 'O-Ring / Seal',
  cleaner_part: 'Cleaner Replacement Part',
  specialty_supply: 'Specialty Supply',
};

export const CATALOG_PRODUCT_TYPE_LABELS: Record<CatalogProductType, string> = {
  ...CHEMICAL_PRODUCT_TYPE_LABELS,
  ...SUPPLY_PRODUCT_TYPE_LABELS,
};

export const CHEMICAL_FORM_LABELS: Record<ChemicalForm, string> = {
  liquid: 'Liquid',
  granular: 'Granular',
  tablet: 'Tablet / Tab',
  powder: 'Powder',
  crystal: 'Crystal',
  gel: 'Gel',
  stick: 'Stick',
  cartridge: 'Cartridge',
  specialty_other: 'Specialty / Other',
};

export const PRODUCT_TYPES_BY_CATEGORY = {
  sanitizers: [
    'liquid_chlorine',
    'trichlor_tabs',
    'bromine_tabs',
    'bromine_granular',
    'salt',
  ],
  balancers: [
    'muriatic_acid',
    'dry_acid',
    'soda_ash',
    'baking_soda',
    'calcium_hardness_increaser',
    'stabilizer',
    'metal_sequestrant',
    'phosphate_remover',
    'enzyme',
    'stain_scale_treatment',
    'specialty_other',
  ],
  shock: [
    'cal_hypo_shock',
    'dichlor_shock',
    'non_chlorine_shock',
    'specialty_other',
  ],
  filter_media: [
    'filter_cartridge',
    'filter_grid_set',
    'specialty_supply',
  ],
  cleaning_tools: [
    'skimmer_net',
    'wall_brush',
    'telescoping_pole',
    'vacuum_head',
    'vacuum_hose',
    'specialty_supply',
  ],
  testing_supplies: [
    'test_strip_pack',
    'reagent_refill',
    'specialty_supply',
  ],
  replacement_parts: [
    'basket',
    'o_ring_seal',
    'cleaner_part',
    'specialty_supply',
  ],
} as const;

export const CHEMICAL_PRODUCT_TYPES_BY_CATEGORY = PRODUCT_TYPES_BY_CATEGORY;
