import type { ReactElement } from 'react';
import type { OperationType } from '../types/game';

type IconProps = {
  className?: string;
  title?: string;
};

/** Blitz — barreira de trânsito / bloqueio. */
export function IconBlitz({ className, title = 'Blitz' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      {/* base do chão */}
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      {/* painel central com listras */}
      <rect x="5" y="8" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 8v9M12 8v9M16 8v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      {/* postes */}
      <path d="M7 8V5.5M17 8V5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="7" cy="4.5" r="1.25" fill="currentColor" />
      <circle cx="17" cy="4.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

/** Cumprimento de mandado — prancheta com documento. */
export function IconMandado({ className, title = 'Cumprimento de mandado' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.75" />
      {/* clip no topo */}
      <path
        d="M9 3.5h6a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 1 0-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <rect x="10.25" y="3.75" width="3.5" height="2" rx="0.75" fill="currentColor" opacity="0.9" />
      {/* linhas do documento */}
      <path d="M8.5 10.5h7M8.5 13.5h7M8.5 16.5h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* carimbo / selo */}
      <circle cx="15.5" cy="16.5" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14.4 16.5l.75.75 1.5-1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Patrulhamento — rota circular com seta (circuito). */
export function IconPatrulha({ className, title = 'Patrulhamento' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      {/* anel da rota */}
      <path
        d="M18.5 12a6.5 6.5 0 1 1-2.1-4.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* seta de sentido */}
      <path d="M18.6 6.2v3.4h-3.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {/* ponto de viatura no circuito */}
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <circle cx="12" cy="5.5" r="1.15" fill="currentColor" opacity="0.7" />
      <circle cx="17.2" cy="14.8" r="1.15" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/** Centro Seguro — escudo. */
export function IconCentroSeguro({ className, title = 'Centro Seguro' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path
        d="M12 3l7 3v5.5c0 4.5-2.9 7.8-7 9.5-4.1-1.7-7-5-7-9.5V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9.5 12.2l1.7 1.7 3.5-3.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Rodovia — estrada. */
export function IconRodovia({ className, title = 'Operação Rodovias' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M4 20L9 4h6l5 16" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M12 7v2.5M12 12.5V15M12 17.5v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Busca e apreensão — lupa + casa. */
export function IconBusca({ className, title = 'Busca e apreensão' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <circle cx="16.5" cy="14.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18.3 16.3L20 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const BY_TYPE: Record<OperationType, (props: IconProps) => ReactElement> = {
  blitz: IconBlitz,
  mandado: IconMandado,
  patrulha: IconPatrulha,
  centro_seguro: IconCentroSeguro,
  rodovia: IconRodovia,
  busca_apreensao: IconBusca,
};

/** Ícone SVG do tipo de operação (substitui emoji). */
export function OperationTypeIcon({ type, className, title }: IconProps & { type: OperationType }) {
  const Cmp = BY_TYPE[type];
  return <Cmp className={className} title={title} />;
}

/** SVG inline para Leaflet DivIcon (sem React). */
export function operationTypeSvgMarkup(type: OperationType, size = 22): string {
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"`;
  if (type === 'blitz') {
    return `<svg ${common}><path d="M3 20h18" stroke="#fbbf24" stroke-width="1.75" stroke-linecap="round"/><rect x="5" y="8" width="14" height="9" rx="1.5" stroke="#fbbf24" stroke-width="1.75"/><path d="M8 8v9M12 8v9M16 8v9" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/><path d="M7 8V5.5M17 8V5.5" stroke="#fbbf24" stroke-width="1.75" stroke-linecap="round"/><circle cx="7" cy="4.5" r="1.25" fill="#fbbf24"/><circle cx="17" cy="4.5" r="1.25" fill="#fbbf24"/></svg>`;
  }
  if (type === 'mandado' || type === 'busca_apreensao') {
    const c = type === 'busca_apreensao' ? '#c4b5fd' : '#60a5fa';
    return `<svg ${common}><rect x="5" y="3.5" width="14" height="17" rx="2" stroke="${c}" stroke-width="1.75"/><path d="M9 3.5h6a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 1 0-3Z" stroke="${c}" stroke-width="1.75"/><rect x="10.25" y="3.75" width="3.5" height="2" rx="0.75" fill="${c}"/><path d="M8.5 10.5h7M8.5 13.5h7M8.5 16.5h4.5" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/><circle cx="15.5" cy="16.5" r="2.25" stroke="${c}" stroke-width="1.4"/><path d="M14.4 16.5l.75.75 1.5-1.6" stroke="${c}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (type === 'centro_seguro') {
    return `<svg ${common}><path d="M12 3l7 3v5.5c0 4.5-2.9 7.8-7 9.5-4.1-1.7-7-5-7-9.5V6l7-3Z" stroke="#34d399" stroke-width="1.75" stroke-linejoin="round"/><path d="M9.5 12.2l1.7 1.7 3.5-3.8" stroke="#34d399" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (type === 'rodovia') {
    return `<svg ${common}><path d="M4 20L9 4h6l5 16" stroke="#fbbf24" stroke-width="1.75" stroke-linejoin="round"/><path d="M12 7v2.5M12 12.5V15M12 17.5v2" stroke="#fbbf24" stroke-width="1.75" stroke-linecap="round"/></svg>`;
  }
  return `<svg ${common}><path d="M18.5 12a6.5 6.5 0 1 1-2.1-4.8" stroke="#2dd4bf" stroke-width="1.75" stroke-linecap="round"/><path d="M18.6 6.2v3.4h-3.4" stroke="#2dd4bf" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.1" fill="#2dd4bf"/><circle cx="12" cy="5.5" r="1.15" fill="#2dd4bf" opacity="0.75"/><circle cx="17.2" cy="14.8" r="1.15" fill="#2dd4bf" opacity="0.55"/></svg>`;
}
