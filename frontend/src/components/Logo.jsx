import React from 'react';

// The app's mark — the Orutumbo cow-head crest, supplied as source artwork
// and cropped into two variants below (see /public/logo-*.png). Rendered
// as <img> rather than inline SVG since this is raster source art, not
// hand-authored vector paths.

// Small inline version — ring + head only, no arched lettering (the fine
// text isn't legible below ~60px, so this variant drops it rather than
// rendering illegible detail). Used in the top bar.
export function LogoMark({ size = 22, className = '' }) {
  const height = size * (868 / 1053); // matches the cropped mark's aspect ratio
  return (
    <img
      src="/logo-mark.png"
      alt="Orutumbo"
      width={size}
      height={height}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Full detailed mark — ring + head + "ORUTUMBO" arched lettering. Used at
// hero size (onboarding, splash), where the lettering is actually legible.
export function LogoFull({ height = 120, className = '' }) {
  const width = height * (1063 / 1217); // matches the full crop's aspect ratio
  return (
    <img
      src="/logo-full.png"
      alt="Orutumbo"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Icon + wordmark row — for places that want the small mark plus text set
// in the app's own type, rather than the full crest image.
export function Logo({ size = 26, textClassName = 'text-lg' }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className={`font-serif text-ink tracking-tight ${textClassName}`}>Orutumbo</span>
    </div>
  );
}
