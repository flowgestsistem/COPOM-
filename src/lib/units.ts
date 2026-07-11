import type { CityBase } from '../types/city';
import type { LatLng, Unit } from '../types/game';
import { BASE_PHOTOS } from '../data/basePhotos';
import { VEHICLE_GROUPS } from '../data/vehiclePhotos';
import { gridOffsetLatLng } from './geo';

const GRID_SPACING_M = 12;

interface FlatVehicle {
  unitType: Unit['type'];
  department: string;
  label: string;
  photoUrl: string;
  /** Número de frota sequencial dentro do departamento (1, 2, 3…). */
  fleetNumber: number;
  /** Índice do modelo/foto (1-based). */
  modelIndex: number;
}

/** Posição numa grade centrada na base, pra não empilhar dezenas de viaturas no mesmo ponto. */
function gridPosition(base: LatLng, index: number, total: number): LatLng {
  if (total <= 1) return base;

  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const row = Math.floor(index / cols);
  const col = index % cols;

  const eastMeters = (col - (cols - 1) / 2) * GRID_SPACING_M;
  const northMeters = ((rows - 1) / 2 - row) * GRID_SPACING_M;

  return gridOffsetLatLng(base, eastMeters, northMeters);
}

function departmentFallback(type: Unit['type']): string {
  if (type === 'bombeiro') return 'Bombeiros';
  if (type === 'ambulancia') return 'SAMU';
  return 'Frota geral';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function vehicleUnits(bases: CityBase[]): Unit[] {
  const flatByBase = new Map<string, FlatVehicle[]>();

  for (const group of VEHICLE_GROUPS) {
    const list = flatByBase.get(group.baseId) ?? [];
    let fleetNumber = 0;

    group.photos.forEach((photo, photoIndex) => {
      for (let copy = 0; copy < photo.count; copy++) {
        fleetNumber += 1;
        list.push({
          unitType: group.unitType,
          department: group.label,
          // Ex.: "Rodoviária 07" — legível e estável
          label: `${group.label} ${pad2(fleetNumber)}`,
          photoUrl: photo.path,
          fleetNumber,
          modelIndex: photoIndex + 1,
        });
      }
    });

    flatByBase.set(group.baseId, list);
  }

  const units: Unit[] = [];
  for (const [baseId, vehicles] of flatByBase) {
    const base = bases.find((b) => b.id === baseId);
    if (!base) continue;

    // id estável sem caracteres problemáticos (/, #, espaços)
    const baseKey = baseId.replace(/[^a-zA-Z0-9]+/g, '-');

    vehicles.forEach((vehicle, i) => {
      units.push({
        id: `unit-${baseKey}-${vehicle.department.replace(/\s+/g, '-').toLowerCase()}-${vehicle.fleetNumber}`,
        baseId,
        type: vehicle.unitType,
        department: vehicle.department,
        label: vehicle.label,
        base: base.location,
        position: gridPosition(base.location, i, vehicles.length),
        status: 'disponivel',
        photoUrl: vehicle.photoUrl,
      });
    });
  }

  return units;
}

export function basesToUnits(bases: CityBase[]): Unit[] {
  const basesWithVehicleGroups = new Set(VEHICLE_GROUPS.map((g) => g.baseId));

  const genericUnits = bases
    .filter((base) => !basesWithVehicleGroups.has(base.id))
    .map(
      (base, index): Unit => ({
        id: `unit-${base.id.replace(/[^a-zA-Z0-9]+/g, '-')}-${index + 1}`,
        baseId: base.id,
        type: base.unitType,
        department: departmentFallback(base.unitType),
        label: `${departmentFallback(base.unitType)} ${pad2(index + 1)}`,
        base: base.location,
        position: base.location,
        status: 'disponivel',
        photoUrl: BASE_PHOTOS[base.id],
      })
    );

  return [...genericUnits, ...vehicleUnits(bases)];
}
