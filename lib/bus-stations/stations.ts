/**
 * The two bus stations both operators collect from. Deliberately a code
 * constant rather than a table: the list is stable and identical across
 * Royal Express and Impala.
 */
export type BusStationId = "mbanza_congo" | "nosso_centro";

export interface BusStation {
  id: BusStationId;
  label: string;
}

export const BUS_STATIONS: readonly BusStation[] = [
  { id: "mbanza_congo", label: "Mbanza Congo" },
  { id: "nosso_centro", label: "Nosso Centro" },
] as const;

export function busStationLabel(id: string | null | undefined): string {
  return BUS_STATIONS.find((s) => s.id === id)?.label ?? "—";
}
