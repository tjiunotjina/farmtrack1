export const SPECIES = ['Cattle', 'Goat', 'Sheep', 'Chicken', 'Pig', 'Horse', 'Donkey', 'Rabbit', 'Other'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Breeds by species — common breeds farmed in Namibia/Southern Africa first.
// "Other" always included so nothing is ever blocked by a missing option.
export const BREEDS_BY_SPECIES = {
  Cattle: ['Brahman', 'Nguni', 'Bonsmara', 'Brangus', 'Afrikaner', 'Simmentaler', 'Angus', 'Hereford', 'Tuli', 'Other'],
  Goat: ['Boer', 'Kalahari Red', 'Savanna', 'Nubian', 'Indigenous/Veld', 'Other'],
  Sheep: ['Dorper', 'Damara', 'Karakul (Swakara)', 'Merino', 'Van Rooy', 'Other'],
  Chicken: ['Broiler', 'Layer', 'Boschveld', 'Potchefstroom Koekoek', 'Indigenous', 'Other'],
  Pig: ['Large White', 'Landrace', 'Duroc', 'Kolbroek', 'Other'],
  Horse: ['Boerperd', 'Thoroughbred', 'Arabian', 'Other'],
  Donkey: ['Standard Donkey', 'Other'],
  Rabbit: ['New Zealand White', 'Californian', 'Other'],
  Other: ['Other'],
};

// Size class drives the weight-estimate curve (see weightEstimate.js) — a
// rough proxy for mature frame size within a species, not a precise
// genetic classification.
export const BREED_SIZE_CLASS = {
  // Cattle
  Brahman: 'large', Simmentaler: 'large', Hereford: 'large',
  Bonsmara: 'medium', Brangus: 'medium', Angus: 'medium', Afrikaner: 'medium',
  Nguni: 'small', Tuli: 'small',
  // Goats
  Boer: 'large', 'Kalahari Red': 'large', Savanna: 'medium', Nubian: 'medium', 'Indigenous/Veld': 'small',
  // Sheep
  Dorper: 'large', Damara: 'medium', 'Van Rooy': 'medium', Merino: 'medium', 'Karakul (Swakara)': 'small',
};

// Common vaccines used in Namibian/Southern African livestock farming.
export const VACCINES = [
  'Clostridial (Multivax P Plus)', 'Anthrax', 'Blackleg', 'Lumpy Skin Disease',
  'Brucellosis (RB51/S19)', 'Rabies', 'Newcastle Disease (poultry)', 'CCPP (goats)',
  'Bluetongue (sheep)', 'Botulism', 'Pasteurellosis', 'Other',
];

export const CONDITIONS = [
  'Foot rot', 'Mastitis', 'Bloat', 'Diarrhoea/Scours', 'Tick-borne disease (Heartwater/Redwater)',
  'Pneumonia/Respiratory', 'Internal parasites (worms)', 'External parasites (ticks/lice)',
  'Eye infection (pink eye)', 'Wound/Injury', 'Lameness', 'Difficult birth', 'Other',
];

export const SYMPTOMS = [
  'Loss of appetite', 'Fever', 'Diarrhoea', 'Coughing', 'Limping', 'Swelling',
  'Discharge (eye/nose)', 'Weight loss', 'Lethargy/Not grazing', 'Bloated abdomen', 'Other',
];

export const TREATMENTS_GIVEN = [
  'Antibiotic injection', 'Dewormer', 'Anti-inflammatory/Pain relief', 'Wound dressing',
  'Vitamin/Mineral supplement', 'Isolation and rest', 'Vet callout', 'Other',
];
