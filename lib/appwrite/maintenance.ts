import { Databases, ID, Query } from "appwrite";
import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MAINTENANCE_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_MAINTENANCE_TABLE_ID ||
  "maintenance";

export type MaintenanceCategory =
  | "General"
  | "Electrical"
  | "Plumbing"
  | "Cleaning"
  | "AC"
  | "Appliance"
  | "Painting"
  | "Pest Control"
  | "Other";

export type MaintenanceStatus =
  | "Pending"
  | "InProgress"
  | "Completed"
  | "Cancelled";

export interface CreateMaintenanceData {
  userId: string;
  propertyId: string;
  title: string;
  category: MaintenanceCategory;
  description?: string | null;
  maintenanceDate: string;
  status?: MaintenanceStatus;
  cost?: number | null;
  providerName?: string | null;
  notes?: string | null;
}

// ==============================
// Create Maintenance
// ==============================

export const createMaintenance = async (
  data: CreateMaintenanceData
) => {
  return await databases.createDocument(
    DATABASE_ID,
    MAINTENANCE_TABLE_ID,
    ID.unique(),
    {
      userId: data.userId,
      propertyId: data.propertyId,
      title: data.title,
      category: data.category,
      description: data.description ?? null,
      maintenanceDate: data.maintenanceDate,
      status: data.status ?? "Pending",
      cost: data.cost ?? 0,
      providerName: data.providerName ?? null,
      notes: data.notes ?? null,
    }
  );
};

// ==============================
// Get All Maintenance Records
// For Current User
// ==============================

export const getUserMaintenance = async (
  userId: string
) => {
  return await databases.listDocuments(
    DATABASE_ID,
    MAINTENANCE_TABLE_ID,
    [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
    ]
  );
};

// ==============================
// Get Maintenance For Property
// ==============================

export const getPropertyMaintenance = async (
  propertyId: string
) => {
  return await databases.listDocuments(
    DATABASE_ID,
    MAINTENANCE_TABLE_ID,
    [
      Query.equal("propertyId", propertyId),
      Query.orderDesc("maintenanceDate"),
    ]
  );
};

// ==============================
// Get Single Maintenance
// ==============================

export const getMaintenanceById = async (
  maintenanceId: string
) => {
  return await databases.getDocument(
    DATABASE_ID,
    MAINTENANCE_TABLE_ID,
    maintenanceId
  );
};

// ==============================
// Update Maintenance
// ==============================

export const updateMaintenance = async (
  maintenanceId: string,
  data: Partial<CreateMaintenanceData>
) => {
  return await databases.updateDocument(
    DATABASE_ID,
    MAINTENANCE_TABLE_ID,
    maintenanceId,
    data
  );
};

// ==============================
// Delete Maintenance
// ==============================

export const deleteMaintenance = async (
  maintenanceId: string
) => {
  return await databases.deleteDocument(
    DATABASE_ID,
    MAINTENANCE_TABLE_ID,
    maintenanceId
  );
};