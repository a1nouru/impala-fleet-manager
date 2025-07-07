// Shared constants for the application

// Agaseke vehicle license plates
export const AGASEKE_PLATES = ["LDA-25-91-AD", "LDA-25-92-AD", "LDA-25-93-AD"];

// Helper function to determine if a vehicle is Agaseke
export const isAgasekeVehicle = (vehiclePlate: string | undefined): boolean => {
  return vehiclePlate ? AGASEKE_PLATES.includes(vehiclePlate) : false;
};