import React from 'react';

// Deliberately simple, geometric line icons (not detailed illustrations) —
// the goal is telling species apart at a glance in a list, not gallery art.
// All share the same stroke weight/viewBox so they sit consistently
// wherever they're used (group headers, animal detail).

const common = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

function Cattle(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M5 7c-1.5 0-2.5 1.3-2 2.6C3.4 10.8 4.5 11 5.5 10.5L9 8.5" {...common} />
      <path d="M19 7c1.5 0 2.5 1.3 2 2.6-.6 1.2-1.7 1.4-2.7.9L15 8.5" {...common} />
      <path d="M7.5 9.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4c0 1.8-.7 3-1.5 4.3-.6 1-1 2.2-1 3.2 0 1.7-1.3 3-3 3-1.5 0-2.7-1.1-2.9-2.6-.2-1.3-.5-2.5-1.1-3.6-.8-1.3-1.5-2.5-1.5-4.3Z" {...common} />
      <circle cx="10" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="11" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Goat(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M9 5c-1.8.5-3 2.2-2.6 4" {...common} />
      <path d="M15 5c1.8.5 3 2.2 2.6 4" {...common} />
      <path d="M8 9c0-2.2 1.8-4 4-4s4 1.8 4 4c0 2-1 3.2-1.6 4.6-.4.9-.6 1.8-.6 2.7 0 1.5-.8 2.7-1.8 2.7s-1.8-1.2-1.8-2.7c0-.9-.2-1.8-.6-2.7C9 12.2 8 11 8 9Z" {...common} />
      <path d="M11.3 17.5c-.3 1-.3 2 0 2.8M12.7 17.5c.3 1 .3 2 0 2.8" {...common} />
      <circle cx="10.3" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="13.7" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Sheep(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M6.5 8.5a2 2 0 1 1 2.3-3.2M17.5 8.5a2 2 0 1 0-2.3-3.2" {...common} />
      <path d="M8 10c-.8-1.6-.3-3.6 1.4-4.5a5 5 0 0 1 5.2 0C16.3 6.4 16.8 8.4 16 10c-.9 1.9-2 2.2-2 4.3 0 1.7.7 2.8.7 4.2 0 1.4-1.2 2.5-2.7 2.5s-2.7-1.1-2.7-2.5c0-1.4.7-2.5.7-4.2C10 12.2 8.9 11.9 8 10Z" {...common} />
      <circle cx="10.2" cy="10.2" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="10.2" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Chicken(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M10.5 4c.5-1 1-1.6 1.5-1.6s1 .6 1.5 1.6c.5-.6 1.1-.8 1.5-.4s.3 1-.2 1.6c1 .1 1.7.6 1.7 1.2 0 .8-1.1 1.4-2.5 1.4H10c-1.4 0-2.5-.6-2.5-1.4 0-.6.7-1.1 1.7-1.2-.5-.6-.6-1.2-.2-1.6s1-.2 1.5.4Z" {...common} />
      <circle cx="12" cy="11" r="4" {...common} />
      <path d="M16 10.5l3 .8-3 1" {...common} />
      <circle cx="10.7" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Pig(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M8 6.5 6 4.5M16 6.5l2-2" {...common} />
      <path d="M6.5 11a5.5 5.5 0 1 1 11 0c0 2.8-1.6 3.8-1.6 5.6 0 1.5-1.1 2.7-2.4 2.7h-3c-1.3 0-2.4-1.2-2.4-2.7 0-1.8-1.6-2.8-1.6-5.6Z" {...common} />
      <ellipse cx="12" cy="12.5" rx="2.3" ry="1.6" {...common} />
      <circle cx="11" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="9.3" cy="9" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="9" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Horse(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M9.5 4.5 8 2M14.5 4.5 16 2" {...common} />
      <path d="M9 5c-1.3 1-2 2.6-2 4.3 0 1.6.6 2.4 1.3 3.4.6.9 1 1.9 1.2 3 .2 1.6.3 3.4-.3 4.8" {...common} />
      <path d="M15 5c1.3 1 2 2.6 2 4.3 0 1.6-.6 2.4-1.3 3.4-.9 1.3-1.2 2.8-3 3-1.4.2-2.7-.3-3.2-1.4" {...common} />
      <path d="M9.5 7.5c1.6-1 3.4-1 5 0" {...common} />
      <circle cx="10" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Donkey(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M8.5 8c-1-1.6-1-3.6.3-5M15.5 8c1-1.6 1-3.6-.3-5" {...common} />
      <ellipse cx="8.4" cy="4.3" rx="1.1" ry="2.3" transform="rotate(-15 8.4 4.3)" {...common} />
      <ellipse cx="15.6" cy="4.3" rx="1.1" ry="2.3" transform="rotate(15 15.6 4.3)" {...common} />
      <path d="M9 7c-1.2 1-1.8 2.5-1.8 4.1 0 1.5.6 2.3 1.2 3.2.6.9 1 2 1.1 3.1.1 1.1.2 2.3-.3 3.1" {...common} />
      <path d="M15 7c1.2 1 1.8 2.5 1.8 4.1 0 1.5-.6 2.3-1.2 3.2-.9 1.2-1.1 2.6-2.8 2.8-1.3.1-2.5-.4-3-1.4" {...common} />
      <circle cx="9.8" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RabbitIcon(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M8.5 10c-1.3-2-1.8-5-.6-7.4 1.6.6 2.7 2.8 2.9 5" {...common} />
      <path d="M15.5 10c1.3-2 1.8-5 .6-7.4-1.6.6-2.7 2.8-2.9 5" {...common} />
      <circle cx="12" cy="13" r="4.3" {...common} />
      <circle cx="10.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <path d="M11 14.5c.5.5 1.5.5 2 0" {...common} />
    </svg>
  );
}

function Other(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="8" cy="8" r="1.8" {...common} />
      <circle cx="16" cy="8" r="1.8" {...common} />
      <circle cx="5.5" cy="13" r="1.6" {...common} />
      <circle cx="18.5" cy="13" r="1.6" {...common} />
      <path d="M12 12c-2.5 0-4.5 1.8-4.5 4.2 0 1.8 1.5 3.3 3.2 2.8.8-.2 1.6-.2 2.6 0 1.7.5 3.2-1 3.2-2.8 0-2.4-2-4.2-4.5-4.2Z" {...common} />
    </svg>
  );
}

const ICONS = {
  Cattle, Goat, Sheep, Chicken, Pig, Horse, Donkey, Rabbit: RabbitIcon,
};

export default function SpeciesIcon({ species, size = 18, className = '', color = '#4A5D3A' }) {
  const Icon = ICONS[species] || Other;
  return <Icon width={size} height={size} className={className} style={{ color }} />;
}
