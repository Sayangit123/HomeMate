export type PropertyType =
  | "Apartment"
  | "House"
  | "Office"
  | "Villa"
  | "Other";

export interface Property {
  $id: string;
  $createdAt: string;
  $updatedAt: string;

  userId: string;

  propertyName: string;
  propertyType: PropertyType;

  address: string;
  location: string | null;

  propertyImages: string | null;

  rooms: string | null;
  appliances: string | null;

  maintenanceHistory: string | null;
  upcomingMaintenance: string | null;
}