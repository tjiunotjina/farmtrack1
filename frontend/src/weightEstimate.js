import { BREED_SIZE_CLASS } from './constants.js';

// Rough growth-stage benchmarks for animals raised on extensive/communal
// grazing (the common case in Namibia) rather than intensive feedlot
// systems, which grow noticeably faster. Sourced from general livestock
// extension figures (FAO, university ag-extension ADG tables), not
// breed-specific research for every listed breed — treat this as a
// starting-point estimate to sanity-check a scale reading or fill in a
// rough figure when a scale isn't handy, never as a substitute for
// actually weighing the animal (for sales, dosing, etc. weigh it for real).
//
// Each species has a birth weight and a series of {toMonth, gramsPerDay}
// stages — growth rate slows in stages as the animal matures.
const GROWTH_CURVES = {
  Cattle: {
    birthKg: 32,
    stages: [{ toMonth: 6, gpd: 550 }, { toMonth: 12, gpd: 450 }, { toMonth: 24, gpd: 350 }, { toMonth: 999, gpd: 120 }],
  },
  Goat: {
    birthKg: 2.8,
    stages: [{ toMonth: 3, gpd: 110 }, { toMonth: 12, gpd: 60 }, { toMonth: 999, gpd: 20 }],
  },
  Sheep: {
    birthKg: 3.8,
    stages: [{ toMonth: 3, gpd: 200 }, { toMonth: 12, gpd: 75 }, { toMonth: 999, gpd: 25 }],
  },
  Pig: {
    birthKg: 1.3,
    stages: [{ toMonth: 6, gpd: 500 }, { toMonth: 999, gpd: 150 }],
  },
  Chicken: {
    birthKg: 0.04,
    stages: [{ toMonth: 2, gpd: 35 }, { toMonth: 999, gpd: 5 }],
  },
  Horse: {
    birthKg: 40,
    stages: [{ toMonth: 12, gpd: 500 }, { toMonth: 36, gpd: 300 }, { toMonth: 999, gpd: 50 }],
  },
  Donkey: {
    birthKg: 25,
    stages: [{ toMonth: 12, gpd: 250 }, { toMonth: 999, gpd: 60 }],
  },
  Rabbit: {
    birthKg: 0.06,
    stages: [{ toMonth: 3, gpd: 30 }, { toMonth: 999, gpd: 10 }],
  },
};

// Size class nudges the estimate up/down within a species — a rough proxy
// for mature frame size, not a precise genetic multiplier.
const SIZE_MULTIPLIER = { large: 1.15, medium: 1.0, small: 0.85 };

function ageInMonths(birthYear, birthMonthName, monthNames) {
  if (!birthYear) return null;
  const now = new Date();
  const monthIndex = birthMonthName ? monthNames.indexOf(birthMonthName) : 0;
  const birth = new Date(Number(birthYear), monthIndex, 1);
  if (birth > now) return null;
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
}

/**
 * Estimates live weight in kg from species, breed, and birth date.
 * Returns null if there's not enough information (no species curve, or no
 * birth date to compute an age from).
 */
export function estimateWeight(species, breed, birthYear, birthMonth, monthNames) {
  const curve = GROWTH_CURVES[species];
  if (!curve) return null;
  const months = ageInMonths(birthYear, birthMonth, monthNames);
  if (months === null) return null;

  let weightG = curve.birthKg * 1000;
  let monthsRemaining = months;
  let lastMonth = 0;
  for (const stage of curve.stages) {
    const monthsInStage = Math.min(monthsRemaining, stage.toMonth - lastMonth);
    if (monthsInStage <= 0) break;
    weightG += monthsInStage * 30 * stage.gpd;
    monthsRemaining -= monthsInStage;
    lastMonth = stage.toMonth;
    if (monthsRemaining <= 0) break;
  }

  const sizeClass = BREED_SIZE_CLASS[breed] || 'medium';
  const kg = (weightG / 1000) * SIZE_MULTIPLIER[sizeClass];
  return Math.round(kg * 10) / 10;
}
