import { Databases, ID, Query } from "appwrite";
import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const PROPERTIES_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_PROPERTIES_TABLE_ID ||
    "properties";

export interface CreatePropertyData {
    userId: string;
    propertyName: string;
    propertyType:
    | "Apartment"
    | "House"
    | "Office"
    | "Villa"
    | "Other";
    address: string;
    location?: string | null;
    propertyImages?: string | null;
    rooms?: string | null;
    appliances?: string | null;
    maintenanceHistory?: string | null;
    upcomingMaintenance?: string | null;
}

export const createProperty = async (
    data: CreatePropertyData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        PROPERTIES_TABLE_ID,
        ID.unique(),
        {
            userId: data.userId,
            propertyName: data.propertyName,
            propertyType: data.propertyType,
            address: data.address,
            location: data.location ?? null,
            propertyImages: data.propertyImages ?? null,
            rooms: data.rooms ?? null,
            appliances: data.appliances ?? null,
            maintenanceHistory:
                data.maintenanceHistory ?? null,
            upcomingMaintenance:
                data.upcomingMaintenance ?? null,
        }
    );
};

export const getUserProperties = async (
    userId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        PROPERTIES_TABLE_ID,
        [
            Query.equal("userId", userId),
            Query.orderDesc("$createdAt"),
        ]
    );
};

export const getPropertyById = async (
    propertyId: string
) => {
    const response = await databases.listDocuments(
        DATABASE_ID,
        PROPERTIES_TABLE_ID,
        [
            Query.equal("$id", propertyId),
            Query.limit(1),
        ]
    );

    if (response.documents.length === 0) {
        throw new Error("Property not found.");
    }

    return response.documents[0];
};

export const updateProperty = async (
    propertyId: string,
    data: Partial<CreatePropertyData>
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        PROPERTIES_TABLE_ID,
        propertyId,
        data
    );
};

export const deleteProperty = async (
    propertyId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        PROPERTIES_TABLE_ID,
        propertyId
    );
};