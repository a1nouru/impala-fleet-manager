// Shared constants for the application

// Agaseke vehicle license plates
export const AGASEKE_PLATES = ["LDA-25-91-AD", "LDA-25-92-AD", "LDA-25-93-AD"];

// Helper function to determine if a vehicle is Agaseke
export const isAgasekeVehicle = (vehiclePlate: string | undefined): boolean => {
  return vehiclePlate ? AGASEKE_PLATES.includes(vehiclePlate) : false;
};

// Helper function to determine if a route is URUBANO
export const isUrubanoRoute = (route: string | undefined | null): boolean => {
  return route?.toUpperCase() === "URUBANO";
};

// Helper function to determine if a route is Interprocencial (interprovincial)
export const isInterprocencialRoute = (route: string | undefined | null): boolean => {
  if (!route) return false;
  const interprocencialRoutes = [
    "BENGUELA - LUANDA",
    "LUANDA - BENGUELA",
    "LUANDA - HUAMBO",
    "HUAMBO - LUANDA",
    "LUANDA - LUBANGO",
    "LUBANGO - LUANDA"
  ];
  return interprocencialRoutes.includes(route.toUpperCase());
};
// Bank account numbers used by slip verification. Impala's account numbers
// are not configured yet — empty strings disable the wrong-account check
// (verification still runs on amounts, it just can't validate accounts).
export const REGULAR_CASH_ACCOUNT = "";
export const REGULAR_TPA_ACCOUNT = "";
export const AGASEKE_ACCOUNT_NUMBER = "";

export type DepositGroup = "regular" | "agaseke" | "mixed" | "unknown";

// Vehicle plates appear with stray whitespace/trailing dots in some records
// (e.g. "LDA-29-14-AE.."). Normalize before any Agaseke comparison.
export const normalizePlate = (plate: string): string =>
  plate.trim().replace(/\.+$/, "").toUpperCase();

// A deposit inherits its group from the vehicles on its linked reports.
export const classifyDepositGroup = (plates: string[]): DepositGroup => {
  if (plates.length === 0) return "unknown";
  const agaseke = plates.filter((p) => isAgasekeVehicle(normalizePlate(p))).length;
  if (agaseke === 0) return "regular";
  if (agaseke === plates.length) return "agaseke";
  return "mixed";
};
