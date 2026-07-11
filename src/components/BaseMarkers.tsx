import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { CityBase } from '../types/city';
import type { UnitType } from '../types/game';
import { BASE_PHOTOS } from '../data/basePhotos';

const PIN_W = 36;
const PIN_H = 44;
/** Hit area mínima para toque no celular. */
const HIT_W = 48;
const HIT_H = 52;

interface TypeStyle {
  /** Cor principal do pin */
  fill: string;
  /** Cor de destaque / ícone */
  accent: string;
  /** Gradiente superior */
  fillLight: string;
  label: string;
}

const STYLE_BY_TYPE: Record<UnitType, TypeStyle> = {
  viatura: {
    fill: '#1d4ed8',
    fillLight: '#3b82f6',
    accent: '#dbeafe',
    label: 'Polícia',
  },
  bombeiro: {
    fill: '#b91c1c',
    fillLight: '#ef4444',
    accent: '#fee2e2',
    label: 'Bombeiros',
  },
  ambulancia: {
    fill: '#047857',
    fillLight: '#10b981',
    accent: '#d1fae5',
    label: 'Saúde',
  },
};

/** Ícone interno SVG por tipo de base. */
function innerGlyph(type: UnitType, accent: string): string {
  if (type === 'viatura') {
    // escudo policial
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L4 6.5v5.2c0 5.4 3.6 10.1 8 11.3 4.4-1.2 8-5.9 8-11.3V6.5L12 3z" stroke="${accent}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 9v5M9.5 11.5h5" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }
  if (type === 'bombeiro') {
    // chama estilizada
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3c1.5 3 1 5.5-.5 7 2-.2 4.5-2 5.5-4.5 2 3 3 6 1.5 9.5C17 18.5 14.8 21 12 21s-5-2.5-6.5-6C4 11 5.5 7.5 8 5c0 2.5 1.2 4 2.5 5-.3-2.5.5-5 1.5-7z" stroke="${accent}" stroke-width="1.7" stroke-linejoin="round"/>
    </svg>`;
  }
  // cruz médica
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="3.5" stroke="${accent}" stroke-width="1.7"/>
    <path d="M12 8v8M8 12h8" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function pinSvg(type: UnitType, uid: string): string {
  const s = STYLE_BY_TYPE[type];
  const glyph = innerGlyph(type, s.accent);
  const gid = `bg-${uid}`;
  const fid = `bs-${uid}`;
  return `<svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
        <stop stop-color="${s.fillLight}"/>
        <stop offset="1" stop-color="${s.fill}"/>
      </linearGradient>
      <filter id="${fid}" x="-30%" y="-15%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <path filter="url(#${fid})" fill="url(#${gid})" stroke="rgba(255,255,255,0.22)" stroke-width="1"
      d="M18 2c7.7 0 14 6.1 14 13.6 0 9.4-11.2 20.6-13.3 22.5a1.1 1.1 0 0 1-1.4 0C15.2 36.2 4 25 4 15.6 4 8.1 10.3 2 18 2z"/>
    <circle cx="18" cy="15.5" r="8.2" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <g transform="translate(10, 7.5)">${glyph}</g>
  </svg>`;
}

function photoPinHtml(photoUrl: string, type: UnitType): string {
  const s = STYLE_BY_TYPE[type];
  return `<div class="base-pin base-pin--photo base-pin--${type}" style="width:${PIN_W}px;height:${PIN_H}px">
    <div class="base-pin__photo-wrap" style="border-color:${s.fillLight};box-shadow:0 0 0 2px ${s.fill},0 3px 10px rgba(0,0,0,0.5)">
      <img src="${photoUrl}" alt="" />
    </div>
    <span class="base-pin__tip" style="border-top-color:${s.fill}"></span>
  </div>`;
}

function safeUid(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

function baseIcon(base: CityBase): L.DivIcon {
  const photo = BASE_PHOTOS[base.id];
  const uid = safeUid(base.id);
  const inner = photo
    ? photoPinHtml(photo, base.unitType)
    : `<div class="base-pin base-pin--${base.unitType}">${pinSvg(base.unitType, uid)}</div>`;
  const padX = (HIT_W - PIN_W) / 2;
  const padTop = Math.max(0, HIT_H - PIN_H);
  const html = `<div class="base-pin-hit" style="width:${HIT_W}px;height:${HIT_H}px;padding:${padTop}px ${padX}px 0;box-sizing:border-box;display:flex;align-items:flex-end;justify-content:center">${inner}</div>`;

  return L.divIcon({
    html,
    className: 'base-pin-leaflet',
    iconSize: [HIT_W, HIT_H],
    iconAnchor: [HIT_W / 2, HIT_H - 2],
    popupAnchor: [0, -PIN_H + 8],
  });
}

export function BaseMarkers({ bases, onSelectBase }: { bases: CityBase[]; onSelectBase: (baseId: string) => void }) {
  // ícones estáveis por id+tipo (evita recriar a cada render)
  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const base of bases) {
      map.set(base.id, baseIcon(base));
    }
    return map;
  }, [bases]);

  return (
    <>
      {bases.map((base) => (
        <Marker
          key={base.id}
          position={base.location}
          icon={icons.get(base.id)!}
          eventHandlers={{ click: () => onSelectBase(base.id) }}
          zIndexOffset={base.unitType === 'viatura' ? 20 : base.unitType === 'bombeiro' ? 15 : 5}
        >
          <Tooltip direction="top" offset={[0, -PIN_H + 6]} opacity={0.95} className="base-pin-tooltip">
            <strong>{base.name}</strong>
            <br />
            <span>{STYLE_BY_TYPE[base.unitType].label}</span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
