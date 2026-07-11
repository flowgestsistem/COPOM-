import { useEffect, type MutableRefObject } from 'react';
import { useMap } from 'react-leaflet';
import type { TrafficVehicle } from '../types/traffic';
import { TRAFFIC_MIN_ZOOM } from '../lib/trafficConfig';

/** Raio base em px por tipo (só bolinha — sem PNG). */
const DOT_RADIUS: Record<TrafficVehicle['kind'], number> = {
  car: 3.2,
  moto: 2.4,
  pickup: 3.4,
  van: 3.5,
  truck: 3.8,
  semi: 4.2,
};

/**
 * Trânsito civil: bolinhas brancas.
 *
 * Canvas fica fixo no container do mapa (NÃO no overlayPane animado).
 * Assim o zoom não “arrasta” os pontos — só redesenhamos nas coords de tela.
 */
export function TrafficLayer({
  vehiclesRef,
}: {
  vehiclesRef: MutableRefObject<TrafficVehicle[]>;
}) {
  const map = useMap();

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'traffic-canvas-layer';
    canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:350',
      // fora do pane com transform CSS do Leaflet
    ].join(';');

    const container = map.getContainer();
    container.appendChild(canvas);

    const syncSize = () => {
      const size = map.getSize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(size.x * dpr));
      const h = Math.max(1, Math.round(size.y * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return dpr;
    };

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = syncSize();
      const size = map.getSize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      const zoom = map.getZoom();
      if (zoom < TRAFFIC_MIN_ZOOM) return;

      const bounds = map.getBounds().pad(0.05);
      const list = vehiclesRef.current;
      const scale = Math.min(1.4, Math.max(0.75, (zoom - 12) * 0.18 + 0.85));

      for (const v of list) {
        if (!bounds.contains(v.position as [number, number])) continue;

        // sempre container point = posição estável em qualquer zoom/pan
        const pt = map.latLngToContainerPoint(v.position);
        const r = DOT_RADIUS[v.kind] * scale;

        let alpha = 0.92;
        if (v.state === 'yielding') alpha = 0.45;
        else if (v.state === 'waiting_light' || v.state === 'queued') alpha = 0.75;
        else if (v.state === 'approached') alpha = 1;

        if (v.state === 'approached') {
          ctx.beginPath();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
          ctx.arc(pt.x, pt.y, r + 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    // redesenha durante o zoom (frame a frame) e no fim
    const onViewChange = () => {
      draw();
    };

    map.on('move', onViewChange);
    map.on('moveend', onViewChange);
    map.on('zoom', onViewChange);
    map.on('zoomend', onViewChange);
    map.on('zoomanim', onViewChange);
    map.on('resize', onViewChange);
    draw();

    // tick da frota (simulação) — só redesenha posições atualizadas
    const iv = window.setInterval(draw, 120);

    return () => {
      window.clearInterval(iv);
      map.off('move', onViewChange);
      map.off('moveend', onViewChange);
      map.off('zoom', onViewChange);
      map.off('zoomend', onViewChange);
      map.off('zoomanim', onViewChange);
      map.off('resize', onViewChange);
      canvas.remove();
    };
  }, [map, vehiclesRef]);

  return null;
}
