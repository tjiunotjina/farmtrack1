import React from 'react';

// The app's mark: traced from a real Namibian livestock ear tag (single
// tapered shape, punch hole, "NAM" ID oval) — with "FarmTrack" where the
// animal's number would normally be stamped. Inline SVG so it stays crisp
// at any size without an extra image request.
const TAG_PATH = "M 93.2,10.9 L 82.6,21.4 L 75.9,59.7 L 62.5,84.6 L 46.3,103.7 L 17.6,122.8 L 10.9,131.4 L 8.0,164.9 L 9.9,182.2 L 23.3,189.8 L 193.6,188.9 L 202.3,186.0 L 207.0,179.3 L 203.2,130.5 L 171.6,107.5 L 155.4,89.3 L 140.1,59.7 L 132.4,20.4 L 124.7,12.8 L 114.2,8.0 Z";
const VIEW_BOX = "0 0 216 198.8";

// Small inline version — just the tag silhouette + punch hole. The "NAM"
// oval and FarmTrack lettering aren't legible below ~60px, so this variant
// drops them rather than rendering illegible detail. Used in the top bar.
export function LogoMark({ size = 22, className = '' }) {
  const height = size * (198.8 / 216);
  return (
    <svg width={size} height={height} viewBox={VIEW_BOX} className={className}>
      <path d={TAG_PATH} fill="#F0D732" stroke="#1a1a1a" strokeWidth="7" strokeLinejoin="round" />
      <circle cx="82" cy="30" r="7" fill="none" stroke="#1a1a1a" strokeWidth="5" />
    </svg>
  );
}

// Full detailed mark — tag + "NAM" ID oval + "FarmTrack" lettering, the way
// the reference ear tag reads. Used at hero size (onboarding, splash),
// where the detail is actually legible.
export function LogoFull({ height = 120, className = '' }) {
  const width = height * (216 / 198.8);
  return (
    <svg width={width} height={height} viewBox={VIEW_BOX} className={className}>
      <path d={TAG_PATH} fill="#F0D732" stroke="#1a1a1a" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="82" cy="30" r="5.5" fill="none" stroke="#1a1a1a" strokeWidth="3.2" />
      <ellipse cx="108" cy="65" rx="30" ry="14" fill="none" stroke="#1a1a1a" strokeWidth="3.2" />
      <text x="108" y="70.5" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="15" fill="#1a1a1a" textAnchor="middle">NAM</text>
      <text x="108" y="140" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="30" fill="#1a1a1a" textAnchor="middle">Farm</text>
      <text x="108" y="175" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="30" fill="#1a1a1a" textAnchor="middle">Track</text>
    </svg>
  );
}

// Icon + wordmark row — for places that want the small mark plus text set
// in the app's own type (e.g. a header where the full tag would be too tall).
export function Logo({ size = 26, textClassName = 'text-lg' }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className={`font-serif text-ink tracking-tight ${textClassName}`}>FarmTrack</span>
    </div>
  );
}
