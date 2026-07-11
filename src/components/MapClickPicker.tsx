import { useMapEvents } from 'react-leaflet';
import type { LatLng } from '../types/game';

export function MapClickPicker({ active, onPick }: { active: boolean; onPick: (location: LatLng) => void }) {
  useMapEvents({
    click(e) {
      if (active) onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}
