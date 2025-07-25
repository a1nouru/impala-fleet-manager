// Shared constants for the application

// Agaseke vehicle license plates
export const AGASEKE_PLATES = ["LDA-25-91-AD", "LDA-25-92-AD", "LDA-25-93-AD"];

// Helper function to determine if a vehicle is Agaseke
export const isAgasekeVehicle = (vehiclePlate: string | undefined): boolean => {
  const isAgaseke = vehiclePlate ? AGASEKE_PLATES.includes(vehiclePlate) : false;
  // Debug logging for vehicle detection
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_VEHICLES) {
    console.log(`🔍 Vehicle check: "${vehiclePlate}" -> isAgaseke: ${isAgaseke}`);
  }
  return isAgaseke;
};