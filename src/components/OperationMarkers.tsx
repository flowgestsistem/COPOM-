import { Fragment } from 'react';
import { Circle, CircleMarker, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng, Operation, OperationType } from '../types/game';
import { UBERLANDIA_CENTER } from '../data/city';
import { OPERATION_MAX_RANGE_METERS } from '../lib/operations';
import { LABEL_BY_OPERATION_TYPE } from '../lib/labels';
import { operationTypeSvgMarkup } from './OperationIcons';

function operationIcon(type: OperationType): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:28px;height:28px;display:grid;place-items:center;background:rgba(12,13,18,0.88);border:1px solid rgba(255,255,255,0.12);border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.55);filter:drop-shadow(0 0 2px #000)">${operationTypeSvgMarkup(type, 18)}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function OperationRangeCircle({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Circle
      center={UBERLANDIA_CENTER}
      radius={OPERATION_MAX_RANGE_METERS}
      pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '10 8', fillOpacity: 0.02 }}
    />
  );
}

export function PendingOperationMarker({
  location,
  radiusMeters,
}: {
  location: LatLng | null;
  radiusMeters?: number;
}) {
  if (!location) return null;
  return (
    <>
      <CircleMarker center={location} radius={8} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.9 }} />
      {radiusMeters && (
        <Circle
          center={location}
          radius={radiusMeters}
          pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '6 4', fillOpacity: 0.08 }}
        />
      )}
    </>
  );
}

export function OperationMarkers({ operations }: { operations: Operation[] }) {
  const active = operations.filter((o) => o.status !== 'concluida' && o.status !== 'interrompida');

  return (
    <>
      {active.map((op) => (
        <Fragment key={op.id}>
          <Marker position={op.location} icon={operationIcon(op.type)}>
            <Popup>
              <strong>{op.title}</strong>
              <br />
              {LABEL_BY_OPERATION_TYPE[op.type]}
              <br />
              Status: {op.status}
              <br />
              Viaturas: {op.unitIds.length}
            </Popup>
          </Marker>
          {(op.type === 'patrulha' ||
            op.type === 'centro_seguro' ||
            op.type === 'rodovia') &&
            op.radiusMeters && (
            <Circle
              center={op.location}
              radius={op.radiusMeters}
              pathOptions={{ color: '#f59e0b', weight: 1.5, dashArray: '6 4', fillOpacity: 0.05 }}
            />
          )}
        </Fragment>
      ))}
    </>
  );
}
