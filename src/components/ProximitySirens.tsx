import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLng, Unit } from '../types/game';
import { haversineDistanceMeters } from '../lib/geo';
import { setSirenVolume, stopAllSirens, type SirenKind } from '../lib/sound';

/** Zoom a partir do qual a sirene começa a ser ouvida (suave). */
const ZOOM_HEAR_START = 14;
/** Zoom em que o fator de zoom da sirene fica no máximo. */
const ZOOM_HEAR_FULL = 17;
/** Volume máximo global (evita estourar o áudio). */
const MAX_VOLUME = 0.75;
/** Alcance em metros no zoom cheio — além disso some o som. */
const HEAR_RANGE_M_AT_FULL_ZOOM = 900;
/** Atualiza volumes enquanto as viaturas se movem. */
const TICK_MS = 150;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Volume 0..1 conforme zoom do mapa e distância da viatura ao centro da tela.
 * Quanto mais zoom e mais perto do centro, mais alto.
 */
function proximityVolume(zoom: number, mapCenter: LatLng, unitPos: LatLng): number {
  const zoomT = clamp01((zoom - ZOOM_HEAR_START) / (ZOOM_HEAR_FULL - ZOOM_HEAR_START));
  if (zoomT <= 0) return 0;

  const rangeM = HEAR_RANGE_M_AT_FULL_ZOOM * (0.35 + 0.65 * zoomT);
  const distM = haversineDistanceMeters(mapCenter, unitPos);
  const distT = clamp01(1 - distM / rangeM);
  if (distT <= 0) return 0;

  const easedDist = distT * distT;
  return zoomT * easedDist * MAX_VOLUME;
}

/**
 * Polícia → sirene-policia.
 * Bombeiro / ambulância → sirene-bombeiros (nunca o áudio de ligação).
 */
function sirenKindForUnit(unit: Unit): SirenKind | null {
  if (unit.type === 'viatura') return 'police';
  if (unit.type === 'bombeiro' || unit.type === 'ambulancia') return 'fire';
  return null;
}

/** Sirene só em código 3 a caminho (ocorrência/apoio). */
function isSirenEnRoute(unit: Unit): boolean {
  return unit.status === 'a_caminho' && unit.responseCode === 3;
}

/**
 * Toca sirenes com volume proporcional ao zoom e à proximidade.
 * O arquivo bombeiros-emergencia.mp3 NÃO é sirene — só toca na ligação.
 */
export function ProximitySirens({ units }: { units: Unit[]; incidents?: unknown }) {
  const map = useMap();
  const unitsRef = useRef(units);
  unitsRef.current = units;

  useEffect(() => {
    const update = () => {
      const zoom = map.getZoom();
      const c = map.getCenter();
      const center: LatLng = [c.lat, c.lng];

      let police = 0;
      let fire = 0;

      for (const unit of unitsRef.current) {
        if (!isSirenEnRoute(unit)) continue;
        const kind = sirenKindForUnit(unit);
        if (!kind) continue;

        const vol = proximityVolume(zoom, center, unit.position);
        if (kind === 'police') police = Math.max(police, vol);
        else fire = Math.max(fire, vol);
      }

      setSirenVolume('police', police);
      setSirenVolume('fire', fire);
    };

    update();
    map.on('zoom', update);
    map.on('move', update);
    map.on('zoomend', update);
    map.on('moveend', update);
    const interval = window.setInterval(update, TICK_MS);

    return () => {
      map.off('zoom', update);
      map.off('move', update);
      map.off('zoomend', update);
      map.off('moveend', update);
      window.clearInterval(interval);
      stopAllSirens();
    };
  }, [map]);

  return null;
}
