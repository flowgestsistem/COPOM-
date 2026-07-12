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

    const t0 = window.requestAnimationFrame(refresh);
    const t1 = window.setTimeout(refresh, 120);
    const t2 = window.setTimeout(refresh, 400);

    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
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
  trafficRef?: MutableRefObject<TrafficVehicle[]>;
  layoutKey?: string | number;
}) {
  return (
    <MapContainer
      center={UBERLANDIA_CENTER}
      zoom={UBERLANDIA_DEFAULT_ZOOM}
      minZoom={10}
      maxZoom={20}
      zoomControl={false}
      className="city-map-root"
      style={{
        height: '100%',
        width: '100%',
        cursor: pickingLocation || incidentSelectMode ? 'crosshair' : undefined,
        background: '#0a0c12',
      }}
    >
      <InvalidateMapSize layoutKey={layoutKey} />
      <MapZoomControl />
      <LayersControl position="topright">
        {/* Mapa base moderno e atualizado (ruas + POIs) */}
        <LayersControl.BaseLayer checked name="Mapa atual (ruas)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
            maxNativeZoom={20}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Satélite HD">
          <TileLayer
            attribution="Tiles &copy; Esri — Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
            maxNativeZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Híbrido (satélite + nomes)">
          <TileLayer
            attribution="Esri World Imagery + Labels"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
            maxNativeZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Modo COPOM (escuro)">
          <TileLayer
            attribution='&copy; OSM &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
            maxNativeZoom={20}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Ruas detalhadas (OSM)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="Rótulos / bairros">
          <TileLayer
            attribution="Esri Reference"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
            maxNativeZoom={19}
            opacity={0.85}
          />
        </LayersControl.Overlay>

        <LayersControl.Overlay name="Trânsito / eixos (referência)">
          <TileLayer
            attribution="Esri Transportation"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
            maxNativeZoom={19}
            opacity={0.7}
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
