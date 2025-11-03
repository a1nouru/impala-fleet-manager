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