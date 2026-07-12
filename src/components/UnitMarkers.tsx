import { memo, useMemo } from 'react';
import L, { DomEvent } from 'leaflet';
import { Marker } from 'react-leaflet';
import type { Unit } from '../types/game';
import { COLOR_BY_UNIT_TYPE, LABEL_BY_UNIT_STATUS } from '../lib/labels';

const PHOTO = 44;
const HIT = 58;

function shortCallsign(label: string): string {
  const rp = label.match(/r[aá]dio\s*patrulha\s*(\d+)/i);
  if (rp) return `RP-${rp[1]}`;
  const tm = label.match(/t[aá]tico\s*(?:m[oó]vel)?\s*(\d+)/i);
  if (tm) return `TM-${tm[1]}`;
  const ur = label.match(/\bur\b.*?(\d+)/i);
  if (ur) return `UR-${ur[1]}`;
  const abts = label.match(/abts.*?(\d+)/i);
  if (abts) return `ABTS-${abts[1]}`;
  const num = label.match(/(\d+)/);
  if (num && label.length > 10) return `${label.slice(0, 3).toUpperCase()}-${num[1]}`;
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}

function typeClass(type: Unit['type']): string {
  if (type === 'bombeiro') return 'fire';
  if (type === 'ambulancia') return 'med';
  return 'police';
}

function statusClass(status: Unit['status'], attention: boolean, code?: Unit['responseCode']): string {
  if (attention) return 'attention';
  if (status === 'a_caminho' && code === 3) return 'code3';
  if (status === 'a_caminho') return 'enroute';
  if (status === 'no_local' || status === 'em_operacao') return 'onscene';
  if (status === 'levando_preso') return 'transport';
  if (status === 'retornando') return 'return';
  return 'busy';
}

/** Normaliza caminho da foto em /public. */
function resolvePhotoSrc(photoUrl?: string): string {
  if (!photoUrl) return '';
  const raw = photoUrl.trim();
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (raw.startsWith('/')) return raw;
  return `/${raw.replace(/^\.?\//, '')}`;
}

function buildUnitIcon(unit: Unit, attention: boolean): L.DivIcon {
  const type = typeClass(unit.type);
  const st = statusClass(unit.status, attention, unit.responseCode);
  const color = attention ? '#fbbf24' : COLOR_BY_UNIT_TYPE[unit.type];
  const callsign = shortCallsign(unit.label);
  const initials = (callsign.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || 'UN').toUpperCase();
  const showSiren =
    unit.status === 'a_caminho' ||
    unit.status === 'no_local' ||
    unit.status === 'em_operacao' ||
    unit.status === 'aguardando_decisao' ||
    unit.status === 'levando_preso';
  const code3 = unit.responseCode === 3 || attention;
  const photoSrc = resolvePhotoSrc(unit.photoUrl);

  // Fallback inline se a imagem falhar (sem ícone quebrado do browser)
  const photoInner = photoSrc
    ? `<img class="unit-pin__img" src="${photoSrc}" alt="" width="${PHOTO}" height="${PHOTO}" decoding="async" draggable="false" onerror="this.onerror=null;var s=document.createElement('span');s.className='unit-pin__fallback';s.textContent='${initials}';this.replaceWith(s);" />`
    : `<span class="unit-pin__fallback">${initials}</span>`;

  const sirenHtml = showSiren
    ? `<div class="unit-pin__sirens${code3 ? ' unit-pin__sirens--code3' : ''}" aria-hidden="true"><span class="unit-pin__led unit-pin__led--blue"></span><span class="unit-pin__led unit-pin__led--red"></span></div>`
    : '';

  const ringSize = PHOTO + 8; // 52
  const plateH = 18;
  const sirenH = showSiren ? 14 : 0;
  const gap = 3;
  const stackH = ringSize + (showSiren ? gap + sirenH : 0) + gap + plateH;
  const hitW = Math.max(HIT, ringSize + 10);
  const hitH = Math.max(HIT, stackH + 6);
  const padX = Math.max(0, (hitW - ringSize) / 2);
  const padTop = Math.max(2, (hitH - stackH) / 2);

  const html = `<div class="unit-pin unit-pin--${type} unit-pin--${st}" style="width:${hitW}px;height:${hitH}px;padding:${padTop}px ${padX}px 0;box-sizing:border-box">
<div class="unit-pin__stack" style="width:${ringSize}px;box-sizing:border-box">
<div class="unit-pin__ring" style="width:${ringSize}px;height:${ringSize}px;border-color:${color};--unit-accent:${color};box-sizing:border-box">
<div class="unit-pin__photo" style="width:${PHOTO}px;height:${PHOTO}px;box-sizing:border-box">${photoInner}</div>
<span class="unit-pin__status-dot" style="background:${color}"></span>
</div>
${sirenHtml}
<div class="unit-pin__plate"><span class="unit-pin__callsign">${callsign}</span></div>
</div>
</div>`;

  return L.divIcon({
    html,
    className: 'unit-marker-leaflet',
    iconSize: [hitW, hitH],
    iconAnchor: [hitW / 2, padTop + ringSize / 2],
  });
}

/** Um único painel (UnitDetailPanel) é aberto no clique — sem popup Leaflet. */
const UnitMapMarker = memo(function UnitMapMarker({
  unit,
  onSelect,
}: {
  unit: Unit;
  onSelect?: (unitId: string) => void;
}) {
  const attention = unit.status === 'aguardando_decisao';
  const icon = useMemo(
    () => buildUnitIcon(unit, attention),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      unit.id,
      unit.status,
      unit.photoUrl,
      unit.type,
      unit.label,
      unit.responseCode,
      attention,
      unit.pendingDecision,
    ]
  );

  return (
    <Marker
      position={unit.position}
      icon={icon}
      eventHandlers={
        onSelect
          ? {
              click: (e) => {
                DomEvent.stopPropagation(e.originalEvent);
                onSelect(unit.id);
              },
            }
          : undefined
      }
      zIndexOffset={attention ? 900 : unit.responseCode === 3 ? 700 : unit.pendingDecision ? 600 : 200}
      title={`${unit.label} — ${LABEL_BY_UNIT_STATUS[unit.status]}`}
    />
  );
});

function isVisibleOnMap(unit: Unit): boolean {
  return unit.status !== 'disponivel';
}

export function UnitMarkers({
  units,
  onSelectUnit,
}: {
  units: Unit[];
  /** mantidos por compatibilidade com CityMap */
  incidents?: unknown[];
  operations?: unknown[];
  bases?: unknown[];
  onSelectUnit?: (unitId: string) => void;
}) {
  const visible = units.filter(isVisibleOnMap);

  return (
    <>
      {visible.map((unit) => (
        <UnitMapMarker key={unit.id} unit={unit} onSelect={onSelectUnit} />
      ))}
    </>
  );
}
