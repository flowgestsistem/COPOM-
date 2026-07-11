import { Polyline } from 'react-leaflet';
import type { Unit } from '../types/game';
import { COLOR_BY_UNIT_TYPE } from '../lib/labels';

export function RouteLines({ units }: { units: Unit[] }) {
  const enRoute = units.filter((u) => u.status === 'a_caminho' && u.route && u.route.length > 1);

  return (
    <>
      {enRoute.map((unit) => (
        <Polyline
          key={unit.id}
          positions={unit.route!}
          pathOptions={{ color: COLOR_BY_UNIT_TYPE[unit.type], weight: 3, opacity: 0.6, dashArray: '6 6' }}
        />
      ))}
    </>
  );
}
