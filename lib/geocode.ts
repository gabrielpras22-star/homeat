// Géocodage des adresses françaises via la Géoplateforme (IGN), service public gratuit.
// https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage

export type GeoResult = { label: string; city: string; lat: number; lng: number }

type Feature = {
  geometry: { coordinates: [number, number] }
  properties: { label: string; city?: string; score?: number; type?: string }
}

export async function geocodeAddress(query: string): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 5) return []
  const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=5&index=address`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Service d’adresses indisponible')
  const json = (await res.json()) as { features?: Feature[] }
  return (json.features || [])
    .filter(f => (f.properties.score ?? 0) >= 0.4)
    .map(f => ({
      label: f.properties.label,
      city: f.properties.city || '',
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }))
}

/** Position publique approximative (≈ 1 km) pour protéger l'adresse de l'hôte. */
export const approx = (v: number) => Math.round(v * 100) / 100
