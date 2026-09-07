import { getStore } from '@netlify/blobs';

// Netlify Blobs is Netlify's built-in persistent key-value store — it works
// automatically once a function is deployed on Netlify (no setup, no
// external database). This replaces backend/db.js's JSON file, which only
// worked because that server had a real, persistent local disk; a Netlify
// Function does not.
const store = () => getStore('farmtrack');

export async function getUser(email) {
  return store().get(`users/${email}`, { type: 'json' });
}

export async function setUser(email, user) {
  await store().setJSON(`users/${email}`, user);
}

export async function getFarm(farmId) {
  return store().get(`farms/${farmId}`, { type: 'json' });
}

export async function setFarm(farmId, farm) {
  await store().setJSON(`farms/${farmId}`, farm);
}

const EMPTY_FARM_DATA = { animals: [], inventory: [], ledger: [], tasks: [] };

export async function getFarmData(farmId) {
  const data = await store().get(`data/${farmId}`, { type: 'json' });
  return data || structuredClone(EMPTY_FARM_DATA);
}

export async function setFarmData(farmId, data) {
  await store().setJSON(`data/${farmId}`, data);
}
