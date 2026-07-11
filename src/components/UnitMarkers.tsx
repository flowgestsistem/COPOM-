import { memo, useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, Marker, Popup } from 'react-leaflet';
import type { CityBase } from '../types/city';
import type { Incident, Operation, Unit } from '../types/game';
import { COLOR_BY_UNIT_TYPE } from '../lib/labels';
import { buildUnitDetail } from '../lib/unitDetail';

const PHOTO_ICON_SIZE = 40;
/** Área mínima de toque no mobile (~48px) sem inflar a foto. */
const HIT_SIZE = 48;
const SIREN_LIGHT_SIZE = 10;
const SIREN_GAP = 4;
const SIREN_SLOT = SIREN_LIGHT_SIZE + SIREN_GAP;

function photoIcon(
  photoUrl: string,
  status: Unit['status'],
  type: Unit['type'],
  attention: boolean
): L.DivIcon {
  const out = status !== 'disponivel';
  const opacity = out ? 0.95 : 1;
  const borderColor = attention ? '#fbbf24' : COLOR_BY_UNIT_TYPE[type];
  const visualHeight = PHOTO_ICON_SIZE + (out ? SIREN_SLOT : 0);
  const hitW = Math.max(HIT_SIZE, PHOTO_ICON_SIZE);
  const hitH = Math.max(HIT_SIZE, visualHeight);
  const padX = (hitW - PHOTO_ICON_SIZE) / 2;
  const padTop = (hitH - visualHeight) / 2;
  const sirenHtml = out
    ? `<span class="unit-marker__siren${attention ? ' unit-marker__siren--attention' : ''}" aria-hidden="true"></span>`
    : '';
  const wrapClass = [
    'unit-marker',
    out ? 'unit-marker--out' : '',
    attention ? 'unit-marker--attention' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return L.divIcon({
    html: `<div class="${wrapClass}" style="width:${hitW}px;height:${hitH}px;padding:${padTop}px ${padX}px 0;box-sizing:border-box">
      <div class="unit-marker__photo" style="width:${PHOTO_ICON_SIZE}px;height:${PHOTO_ICON_SIZE}px;border-color:${borderColor};opacity:${opacity}">
        <img src="${photoUrl}" alt="" />
      </div>
      ${sirenHtml}
    </div>`,
    className: 'unit-marker-leaflet',
    iconSize: [hitW, hitH],
    iconAnchor: [hitW / 2, padTop + PHOTO_ICON_SIZE / 2],
  });
}

function UnitPopup({
  unit,
  incidents,
  operations,
  bases,
}: {
  unit: Unit;
  incidents: Incident[];
  operations: Operation[];
  bases: CityBase[];
}) {
  const d = buildUnitDetail(unit, incidents, operations, bases);

  return (
    <Popup className="unit-popup" maxWidth={300} minWidth={260}>
      <div className="unit-popup__card">
        {unit.photoUrl && (
          <img src={unit.photoUrl} alt="" className="unit-popup__photo" />
        )}
        <div className="unit-popup__head">
          <strong>{d.headline}</strong>
          <span>
            {d.department} · {d.typeLabel}
          </span>
        </div>

        <div className="unit-popup__row">
          <span className="unit-popup__label">Status</span>
          <span className="unit-popup__value">
            {d.statusLabel}
            {d.codeLabel ? ` · ${d.codeLabel}` : ''}
          </span>
        </div>

        {d.missionLabel && (
          <div className="unit-popup__row">
            <span className="unit-popup__label">Missão</span>
            <span className="unit-popup__value">{d.missionLabel}</span>
          </div>
        )}

        {d.destination && (
          <div className="unit-popup__block">
            <span className="unit-popup__label">Destino</span>
            <strong className="unit-popup__dest">{d.destination.title}</strong>
            <span className="unit-popup__muted">{d.destination.detail}</span>
            {d.routeProgressPct !== null && (
              <span className="unit-popup__muted">
                Trajeto {d.routeProgressPct}%
                {d.etaLabel ? ` · ${d.etaLabel}` : ''}
              </span>
            )}
          </div>
        )}

        <div className={`unit-popup__cargo unit-popup__cargo--${d.cargo.kind}`}>
          <span className="unit-popup__label">
            {unit.type === 'viatura' ? 'Condução' : 'Paciente / vítima'}
          </span>
          <strong>{d.cargo.title}</strong>
          {d.cargo.reason && <span className="unit-popup__muted">{d.cargo.reason}</span>}
        </div>

        {d.incident && (
          <div className="unit-popup__block">
            <span className="unit-popup__label">Ocorrência</span>
            <strong className="unit-popup__dest">{d.incident.title}</strong>
            <span className="unit-popup__muted">
              {d.incident.typeLabel}
              {d.incident.zone ? ` · ${d.incident.zone}` : ''} · P{d.incident.priority}
            </span>
          </div>
        )}

        {d.service && (
          <div className="unit-popup__row">
            <span className="unit-popup__label">No local</span>
            <span className="unit-popup__value">
              {d.service.role}
              {d.service.remaining ? ` · ${d.service.remaining}` : ''}
            </span>
          </div>
        )}

        {d.pendingHint && (
          <p className="unit-popup__hint">{d.pendingHint} — clique para abrir</p>
        )}
        {!d.pendingHint && (
          <p className="unit-popup__hint unit-popup__hint--soft">Clique no ícone para o painel completo</p>
        )}
      </div>
    </Popup>
  );
}

const UnitPhotoMarker = memo(function UnitPhotoMarker({
  unit,
  incidents,
  operations,
  bases,
  onSelect,
}: {
  unit: Unit;
  incidents: Incident[];
  operations: Operation[];
  bases: CityBase[];
  onSelect?: (unitId: string) => void;
}) {
  const { status, photoUrl, type, position, pendingDecision } = unit;
  const attention = status === 'aguardando_decisao';
  const icon = useMemo(
    () => photoIcon(photoUrl!, status, type, attention),
    [status, photoUrl, type, attention]
  );

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={
        onSelect
          ? {
              click: () => onSelect(unit.id),
            }
          : undefined
      }
      zIndexOffset={attention ? 800 : pendingDecision ? 600 : 0}
    >
      <UnitPopup unit={unit} incidents={incidents} operations={operations} bases={bases} />
    </Marker>
  );
});

function isVisibleOnMap(unit: Unit): boolean {
  return unit.status !== 'disponivel';
}

export function UnitMarkers({
  units,
  incidents = [],
  operations = [],
  bases = [],
  onSelectUnit,
}: {
  units: Unit[];
  incidents?: Incident[];
  operations?: Operation[];
  bases?: CityBase[];
  onSelectUnit?: (unitId: string) => void;
}) {
  const visible = units.filter(isVisibleOnMap);

  return (
    <>
      {visible.map((unit) =>
        unit.photoUrl ? (
          <UnitPhotoMarker
            key={unit.id}
            unit={unit}
            incidents={incidents}
            operations={operations}
            bases={bases}
            onSelect={onSelectUnit}
          />
        ) : (
          <CircleMarker
            key={unit.id}
            center={unit.position}
            radius={unit.status === 'aguardando_decisao' ? 9 : 6}
            pathOptions={{
              color: unit.status === 'aguardando_decisao' ? '#fbbf24' : COLOR_BY_UNIT_TYPE[unit.type],
              fillColor: unit.status === 'aguardando_decisao' ? '#fbbf24' : COLOR_BY_UNIT_TYPE[unit.type],
              fillOpacity: 0.9,
            }}
            eventHandlers={
              onSelectUnit
                ? { click: () => onSelectUnit(unit.id) }
                : undefined
            }
          >
            <UnitPopup
              unit={unit}
              incidents={incidents}
              operations={operations}
              bases={bases}
            />
          </CircleMarker>
        )
      )}
    </>
  );
}
