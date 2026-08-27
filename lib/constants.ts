// Shared constants for the application

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
