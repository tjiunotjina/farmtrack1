import { MONTHS } from './constants.js';

// Turns a birth month/year into a human age like "1y 4mo", "7mo", or
// "Newborn" — computed live from the current date rather than a manually
// typed string, so it stays accurate without anyone updating it by hand.
// Returns null when there's no birth data to work from (caller should
// fall back to whatever manual age text exists).
export function calcAge(birthYear, birthMonth) {
  if (!birthYear) return null;

  const now = new Date();
  const monthIndex = birthMonth ? MONTHS.indexOf(birthMonth) : 0; // unknown month -> January, best guess
  const birth = new Date(Number(birthYear), monthIndex, 1);
  if (birth > now) return null; // birth date in the future — bad data, don't guess

  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 0) months = 0;

  if (!birthMonth) {
    // Only a year was given — a precise month count would be false
    // precision, so just show years (or "<1y" for the current year).
    const years = now.getFullYear() - Number(birthYear);
    return years <= 0 ? '<1y' : `${years}y`;
  }

  if (months < 1) return 'Newborn';
  if (months < 24) return `${months}mo`;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths === 0 ? `${years}y` : `${years}y ${remMonths}mo`;
}
