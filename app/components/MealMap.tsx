'use client'

import { useEffect, useRef } from 'react'
import type * as L from 'leaflet'

export type MapPoint = {
  id: string
  lat: number
  lng: number
  label: string
  title: string
}

type Props = {
  points: MapPoint[]
  onSelect?: (id: string) => void
  /** Affiche une zone (cercle) au lieu d'un repère précis, pour une seule table. */
  area?: boolean
  height?: number
}

const FRANCE: [number, number] = [46.6, 2.4]

/** Carte Leaflet / OpenStreetMap. Les positions affichées sont approximatives (≈ 1 km). */
export default function MealMap({ points, onSelect, area = false, height = 460 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const lib = useRef<typeof L | null>(null)
  const selectRef = useRef(onSelect)

  useEffect(() => { selectRef.current = onSelect }, [onSelect])

  const draw = () => {
    const Lf = lib.current
    if (!Lf || !map.current || !layer.current) return
    layer.current.clearLayers()
    const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    valid.forEach(p => {
      if (area) {
        Lf.circle([p.lat, p.lng], { radius: 700, color: '#A7C7E7', weight: 1.5, fillColor: '#A7C7E7', fillOpacity: 0.18 }).addTo(layer.current!)
        return
      }
      const icon = Lf.divIcon({
        className: 'map-pin-wrap',
        html: `<span class="map-pin">${escapeHtml(p.label)}</span>`,
        iconSize: undefined,
        iconAnchor: [0, 0],
      })
      Lf.marker([p.lat, p.lng], { icon, title: p.title, keyboard: true })
        .on('click', () => selectRef.current?.(p.id))
        .addTo(layer.current!)
    })
    if (valid.length === 1) map.current.setView([valid[0].lat, valid[0].lng], area ? 13 : 12)
    else if (valid.length > 1) map.current.fitBounds(Lf.latLngBounds(valid.map(p => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 13 })
  }

  // Toujours la version la plus récente de draw (la carte se charge de façon asynchrone).
  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw })

  // Création de la carte (une seule fois).
  useEffect(() => {
    let cancelled = false
    import('leaflet').then(mod => {
      if (cancelled || !box.current || map.current) return
      const Lf = (mod.default ?? mod) as typeof L
      lib.current = Lf
      map.current = Lf.map(box.current, { center: FRANCE, zoom: 5, scrollWheelZoom: false, attributionControl: true })
      Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(map.current)
      layer.current = Lf.layerGroup().addTo(map.current)
      drawRef.current()
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Mise à jour des repères, seulement quand la liste change (sinon le zoom de l'utilisateur serait perdu).
  const pointsKey = (area ? 'a|' : 'm|') + points.map(p => `${p.id}:${p.lat}:${p.lng}:${p.label}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { draw() }, [pointsKey])

  return <div ref={box} className="map" style={{ height }} role="region" aria-label="Carte des tables" />
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
