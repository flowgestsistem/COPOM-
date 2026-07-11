// Script de build único: busca dados reais de Uberlândia no OpenStreetMap
// (via Overpass API) e salva como JSON estático em src/data/.
// Rodar apenas quando precisar atualizar os dados: node scripts/fetch-city-data.mjs
import { writeFile } from 'node:fs/promises';

const BBOX = { south: -18.97, west: -48.34, north: -18.86, east: -48.21 };
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const AMENITY_TO_UNIT_TYPE = {
  police: 'viatura',
  fire_station: 'bombeiro',
  hospital: 'ambulancia',
};

function defaultNameFor(unitType) {
  switch (unitType) {
    case 'viatura':
      return 'Delegacia';
    case 'bombeiro':
      return 'Corpo de Bombeiros';
    case 'ambulancia':
      return 'Hospital';
  }
}

async function overpassQuery(query, attempt = 1) {
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'copom-uberlandia-game/0.1 (dev script, one-off data fetch)',
      Accept: '*/*',
    },
  });

  if (res.status === 429 || res.status === 504) {
    if (attempt >= 5) throw new Error(`Overpass API respondeu ${res.status} após ${attempt} tentativas`);
    const waitMs = attempt * 20_000;
    console.log(`Overpass respondeu ${res.status}, tentativa ${attempt}. Aguardando ${waitMs / 1000}s...`);
    await new Promise((r) => setTimeout(r, waitMs));
    return overpassQuery(query, attempt + 1);
  }

  if (!res.ok) throw new Error(`Overpass API respondeu ${res.status}`);
  return res.json();
}

async function fetchBases() {
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const clauses = Object.keys(AMENITY_TO_UNIT_TYPE)
    .map((a) => `node["amenity"="${a}"](${bbox});way["amenity"="${a}"](${bbox});`)
    .join('\n  ');
  const query = `[out:json][timeout:60];\n(\n  ${clauses}\n);\nout center;`;

  const data = await overpassQuery(query);
  return data.elements
    .map((el) => {
      const amenity = el.tags?.amenity;
      const unitType = amenity ? AMENITY_TO_UNIT_TYPE[amenity] : undefined;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!unitType || lat === undefined || lon === undefined) return null;
      return {
        id: `${el.type}/${el.id}`,
        unitType,
        name: el.tags?.name ?? defaultNameFor(unitType),
        location: [lat, lon],
      };
    })
    .filter(Boolean);
}

async function fetchStreets() {
  const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const highwayTypes = ['primary', 'secondary', 'tertiary'];
  const clauses = highwayTypes.map((h) => `way["highway"="${h}"]["name"](${bbox});`).join('\n  ');
  const query = `[out:json][timeout:60];\n(\n  ${clauses}\n);\nout geom;`;

  const data = await overpassQuery(query);
  return data.elements
    .map((el) => {
      const name = el.tags?.name;
      if (!name || !el.geometry || el.geometry.length < 2) return null;
      return {
        id: `${el.type}/${el.id}`,
        name,
        points: el.geometry.map((p) => [p.lat, p.lon]),
      };
    })
    .filter(Boolean);
}

const bases = await fetchBases();
console.log(`${bases.length} bases encontradas`);
await writeFile(new URL('../src/data/bases.json', import.meta.url), JSON.stringify(bases, null, 2));

// espera um pouco entre as duas consultas para não sobrecarregar o servidor público
await new Promise((r) => setTimeout(r, 5000));

const streets = await fetchStreets();
console.log(`${streets.length} ruas encontradas`);
await writeFile(new URL('../src/data/streets.json', import.meta.url), JSON.stringify(streets, null, 2));

console.log('Dados salvos em src/data/bases.json e src/data/streets.json');
