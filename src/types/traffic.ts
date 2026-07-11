import type { LatLng } from './game';

/** Tipos de veículos civis no trânsito de Uberlândia. */
export type TrafficKind = 'car' | 'moto' | 'pickup' | 'van' | 'truck' | 'semi';

export type TrafficState =
  | 'moving'
  | 'stopped'
  | 'waiting_light'
  | 'yielding'
  | 'queued'
  /** Parado por abordagem de viatura em patrulha. */
  | 'approached';

export interface TrafficVehicle {
  id: string;
  kind: TrafficKind;
  /** Índice na rede viária pré-processada. */
  streetIndex: number;
  /** Progresso 0..1 ao longo da rua (direção positiva = início→fim). */
  progress: number;
  direction: 1 | -1;
  /** Velocidade-base em m/s. */
  speedMps: number;
  position: LatLng;
  /** Azimute em graus (0 = norte). */
  heading: number;
  state: TrafficState;
  waitUntil: number;
  /** Id da “onda” de semáforo naquele trecho (para parar em pares). */
  lightGroup: number;
  /** Unidade policial que abordou este veículo. */
  approachUnitId?: string;
  /** Até quando fica parado na abordagem. */
  approachUntil?: number;
}
