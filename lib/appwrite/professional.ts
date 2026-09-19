import { Databases, ID, Query } from "appwrite";
import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const PROFESSIONALS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROFESSIONALS_TABLE_ID ||
  "professionals";

export interface CreateProfessionalData {
  userId: string;
  professionalName: string;
  serviceCategory: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceArea?: string | null;
  rating?: number | null;
  availability?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  locationVisibility?: boolean;
}

/**
 * Create professional
 */
export const createProfessional = async (
  data: CreateProfessionalData
) => {
  return await databases.createDocument(
    DATABASE_ID,
    PROFESSIONALS_TABLE_ID,
    ID.unique(),
    {
      userId: data.userId,
      professionalName: data.professionalName,
      serviceCategory: data.serviceCategory,
      description: data.description ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      serviceArea: data.serviceArea ?? null,
      rating: data.rating ?? null,
      availability: data.availability ?? null,
      minPrice: data.minPrice ?? 0,
      maxPrice: data.maxPrice ?? 0,
      locationVisibility:
        data.locationVisibility ?? true,
    }
  );
};

/**
 * Get all professionals
 */
export const getProfessionals = async () => {
  return await databases.listDocuments(
    DATABASE_ID,
    PROFESSIONALS_TABLE_ID,
    [
      Query.orderDesc("$createdAt"),
    ]
  );
};

/**
 * Get professional by user ID
 */
export const getProfessionalByUserId = async (
  userId: string
) => {
  const response = await databases.listDocuments(
    DATABASE_ID,
    PROFESSIONALS_TABLE_ID,
    [
      Query.equal("userId", userId),
    ]
  );

  return response.documents[0] ?? null;
};

/**
 * Get professional by document ID
 */
export const getProfessionalById = async (
  professionalId: string
) => {
  return await databases.getDocument(
    DATABASE_ID,
    PROFESSIONALS_TABLE_ID,
    professionalId
  );
};

/**
 * Update professional
 */
export const updateProfessional = async (
  professionalId: string,
  data: Partial<CreateProfessionalData>
) => {
  return await databases.updateDocument(
    DATABASE_ID,
    PROFESSIONALS_TABLE_ID,
    professionalId,
    data
  );
};

/**
 * Update professional service area
 *
 * This function is specifically used by the
 * Service Area Management feature.
 */
export const updateProfessionalServiceArea = async (
  professionalId: string,
  serviceArea: string
) => {
  return await databases.updateDocument(
    DATABASE_ID,
    PROFESSIONALS_TABLE_ID,
    professionalId,
    {
      serviceArea: serviceArea.trim(),
    }
  );
};

/**
 * Delete professional
 */
export const deleteProfessional = async (
  professionalId: string
) => {
  return await databases.deleteDocument(
    DATABASE_ID,
    PROFESSIONALS_TABLE_ID,
    professionalId
  );
};