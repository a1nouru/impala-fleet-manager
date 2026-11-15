import { describe, it, expect } from "vitest";
import { parsePart, scoreDrivers, type ReportInput, type MaintenanceInput } from "./score";

const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;
const reports = (driver: string | null, vehicle: string, days: number, revenue: number): ReportInput[] =>
  Array.from({ length: days }, (_, i) => ({
    vehicle_id: vehicle, report_date: day(i + 1), status: "Operational", driver_id: driver,
    ticket_revenue: revenue, baggage_revenue: 0, cargo_revenue: 0,
  }));

describe("parsePart", () => {
  it("classifies tires, routine service and wear parts and reads Qty", () => {
    expect(parsePart("PNEU GORDEN CROWN (Qty: 2)")).toEqual({ name: "PNEU GORDEN CROWN", qty: 2, kind: "tire" });
    expect(parsePart("Tire - 315/80R22.5")?.kind).toBe("tire");
    expect(parsePart("Óleo Do Motor Sinopec 15W40 (Qty: 23)")?.kind).toBe("routine");
    expect(parsePart("FILTRO DE ÓLEO JX0818 (Qty: 2)")?.kind).toBe("routine");
    expect(parsePart("Brake disc pads (Qty: 1)")?.kind).toBe("wear");
    expect(parsePart("VALVUNINA MAMBA GEAR 85W140")?.kind).toBe("routine");
    expect(parsePart("LF9009")?.kind).toBe("routine");
    expect(parsePart("9009 (Qty: 1)")?.kind).toBe("routine");
    expect(parsePart("12R22.5 LISO")?.kind).toBe("tire");
    expect(parsePart("5TIRE 315/80R22.5")?.kind).toBe("tire");
    expect(parsePart("DISCO DE EMBREAGEM HIGER (Qty: 1)")?.kind).toBe("clutch");
    expect(parsePart("Disco de embraiagem")?.kind).toBe("clutch");
    expect(parsePart("DISCO DE EMBREIAGEM")?.kind).toBe("clutch");
    expect(parsePart("Bomba central de embraiagem")?.kind).toBe("wear");
    expect(parsePart("Disco de travão Higer")?.kind).toBe("wear");
    expect(parsePart("JOGO DE CINTA DE TRÁS.")?.kind).toBe("wear");
    expect(parsePart("  (Qty: 1)")).toBeNull();
  });
});

describe("scoreDrivers", () => {
  const drivers = [{ id: "a", nome: "Ana" }, { id: "b", nome: "Beto" }, { id: "c", nome: "Caio" }, { id: "d", nome: "Dino" }];
  const maintenance: MaintenanceInput[] = [
    { vehicle_id: "v2", date: day(10), driver_id: "b", cost: 300000, parts: ["PNEU X (Qty: 2)", "CALÇO (Qty: 1)", "DISCO DE EMBREAGEM (Qty: 1)", "SINOPEC 15W40 (Qty: 23)"] },
    { vehicle_id: "v3", date: day(5), driver_id: "c", cost: 100000, parts: ["Brake disc pads (Qty: 1)"] },
  ];
  const result = scoreDrivers({
    from: day(1), to: day(30), drivers, maintenance,
    reports: [
      ...reports("a", "v1", 30, 500000),
      ...reports("b", "v2", 30, 400000),
      ...reports(null, "v3", 12, 450000),
      ...reports("d", "v4", 5, 900000),
    ],
    damages: [{ employee_id: "b", damage_date: day(3), total_damage_cost: 150000 }],
  });
  const byId = Object.fromEntries(result.map((r) => [r.driverId, r]));

  it("estimates the driver of reports without one from nearby maintenance records", () => {
    expect(byId.c.daysDriven).toBe(12);
    expect(byId.c.estimatedDays).toBe(12);
    expect(byId.a.estimatedDays).toBe(0);
  });

  it("counts tires and wear parts but not routine service, normalised per 30 days", () => {
    expect(byId.b.tires).toBe(2);
    expect(byId.b.wearParts).toBe(1);
    expect(byId.b.clutches).toBe(1);
    expect(byId.b.per30.tires).toBe(2);
  });

  it("does not rank drivers below the minimum days driven", () => {
    expect(byId.c.tier).toBe("insufficient");
    expect(byId.d.tier).toBe("insufficient");
    expect(byId.d.score).toBeNull();
  });

  it("ranks the clean high earner above the driver with tires, parts and a damage", () => {
    expect(byId.a.score).toBe(100);
    expect(byId.a.tier).toBe("raise");
    expect(byId.b.score).toBe(0);
    expect(byId.b.tier).toBe("watch");
    expect(result[0].driverId).toBe("a");
  });
});
