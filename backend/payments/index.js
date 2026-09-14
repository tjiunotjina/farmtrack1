import * as manual from './manual.js';

// Add a new provider by writing an adapter file matching provider.js's
// shape, then registering it here — nothing else in the billing system
// needs to change.
const PROVIDERS = {
  manual,
};

export function getProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown payment provider: ${name}`);
  return provider;
}

export function availableProviders() {
  return Object.keys(PROVIDERS);
}
