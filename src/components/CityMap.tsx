import { useEffect } from 'react';
import { LayersControl, MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../lib/leafletIcons';
import { UBERLANDIA_CENTER, UBERLANDIA_DEFAULT_ZOOM } from '../data/city';
import type { CityBase } from '../types/city';
import type { Incident, LatLng, Operation, Unit } from '../types/game';
import { UnitMarkers } from './UnitMarkers';
import { IncidentMarkers } from './IncidentMarkers';
import { RouteLines } from './RouteLines';
import { MapClickPicker } from './MapClickPicker';
import { OperationMarkers, OperationRangeCircle, PendingOperationMarker } from './OperationMarkers';
import { BaseMarkers } from './BaseMarkers';
import { ProximitySirens } from './ProximitySirens';
import { TrafficLayer } from './TrafficLayer';
import type { MutableRefObject } from 'react';
import type { TrafficVehicle } from '../types/traffic';

const FOCUS_ZOOM = 15;
const FOLLOW_ZOOM = 16;

/** Recalcula tamanho do mapa após resize/orientação ou quando o shell mobile muda. */
function InvalidateMapSize({ layoutKey }: { layoutKey?: string | number }) {
  const map = useMap();

  useEffect(() => {
    const refresh = () => {
      map.invalidateSize({ animate: false });
    };

    // mount + um frame depois (layout flex/mobile às vezes atrasa o box)
    const t0 = window.requestAnimationFrame(refresh);
    const t1 = window.setTimeout(refresh, 120);
    const t2 = window.setTimeout(refresh, 400);

    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    // iOS: barra de endereço muda o viewport visual
    const vv = window.visualViewport;
    vv?.addEventListener('resize', refresh);

    return () => {
      window.cancelAnimationFrame(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      vv?.removeEventListener('resize', refresh);
    };
  }, [map]);

  useEffect(() => {
    if (layoutKey === undefined) return;
    const t = window.setTimeout(() => map.invalidateSize({ animate: false }), 80);
    return () => window.clearTimeout(t);
  }, [layoutKey, map]);

  return null;
}

function MapZoomControl() {
  return <ZoomControl position="bottomright" />;
}

function FlyToOnAlert({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 1.2 });
  }, [target, map]);
  return null;
}

/** Mantém o mapa centrado na unidade seguida (atualiza a cada mudança de posição). */
function FollowUnitCamera({
  unitId,
  units,
}: {
  unitId: string | null;
  units: Unit[];
}) {
  const map = useMap();
  const unit = unitId ? units.find((u) => u.id === unitId) : null;
  const lat = unit?.position[0];
  const lng = unit?.position[1];

  useEffect(() => {
    if (!unitId || lat === undefined || lng === undefined) return;
    const z = Math.max(map.getZoom(), FOLLOW_ZOOM);
    // panTo suave e frequente — sem flyTo para não “brigar” com o movimento
    map.panTo([lat, lng], { animate: true, duration: 0.35, easeLinearity: 0.25 });
    if (map.getZoom() < FOLLOW_ZOOM) {
      map.setZoom(z, { animate: true });
    }
  }, [unitId, lat, lng, map]);

  return null;
}

export function CityMap({
  units,
  incidents,
  blinkingIds,
  focusLocation,
  followUnitId = null,
  operations,
  pickingLocation,
  onPickLocation,
  pendingLocation,
  pendingRadiusMeters,
  bases,
  onSelectBase,
  incidentSelectMode = false,
  onSelectIncident,
  onSelectUnit,
  trafficRef,
  layoutKey,
}: {
  units: Unit[];
  incidents: Incident[];
  blinkingIds: Set<string>;
  focusLocation: LatLng | null;
  /** ID da unidade a seguir com a câmera (null = desligado). */
  followUnitId?: string | null;
  operations: Operation[];
  pickingLocation: boolean;
  onPickLocation: (location: LatLng) => void;
  pendingLocation: LatLng | null;
  pendingRadiusMeters?: number;
  bases: CityBase[];
  onSelectBase: (baseId: string) => void;
  incidentSelectMode?: boolean;
  onSelectIncident?: (incidentId: string) => void;
  onSelectUnit?: (unitId: string) => void;
  /** Trânsito civil (vida da cidade) — ref para não re-renderizar o mapa a cada tick. */
  trafficRef?: MutableRefObject<TrafficVehicle[]>;
  /** Muda quando o layout shell (mobile/aba) redimensiona o mapa. */
  layoutKey?: string | number;
}) {
  return (
    <MapContainer
      center={UBERLANDIA_CENTER}
      zoom={UBERLANDIA_DEFAULT_ZOOM}
      minZoom={8}
      maxZoom={19}
      zoomControl={false}
      style={{
        height: '100%',
        width: '100%',
        cursor: pickingLocation || incidentSelectMode ? 'crosshair' : undefined,
      }}
    >
      <InvalidateMapSize layoutKey={layoutKey} />
      <MapZoomControl />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satélite">
          <TileLayer
            attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            maxNativeZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Ruas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.Overlay checked name="Nomes de ruas e bairros">
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            maxNativeZoom={19}
          />
        </LayersControl.Overlay>
      </LayersControl>
      {trafficRef && <TrafficLayer vehiclesRef={trafficRef} />}
      <BaseMarkers bases={bases} onSelectBase={onSelectBase} />
      <RouteLines units={units} />
      <UnitMarkers
        units={units}
        incidents={incidents}
        operations={operations}
        bases={bases}
        onSelectUnit={onSelectUnit}
      />
      <IncidentMarkers
        incidents={incidents}
        blinkingIds={blinkingIds}
        selectMode={incidentSelectMode}
        onSelectIncident={onSelectIncident}
      />
      <OperationMarkers operations={operations} />
      <OperationRangeCircle visible={pickingLocation} />
      <PendingOperationMarker location={pendingLocation} radiusMeters={pendingRadiusMeters} />
      <MapClickPicker active={pickingLocation} onPick={onPickLocation} />
      <FlyToOnAlert target={followUnitId ? null : focusLocation} />
      <FollowUnitCamera unitId={followUnitId} units={units} />
      <ProximitySirens units={units} />
    </MapContainer>
  );
}
