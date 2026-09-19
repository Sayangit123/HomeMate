import {
    Databases,
    ID,
    Query,
    Permission,
    Role,
} from "appwrite";

import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const SERVICES_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_SERVICES_TABLE_ID ||
    "services";

/* ============================================================
   TYPES
============================================================ */

export type ServiceDay =
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";

export interface CreateServiceData {
    userId: string;
    serviceName: string;
    description?: string | null;
    duration: number;
    price: number;
    availableDays: string[];
    availableSlots: string[];
}

export interface UpdateServiceData {
    serviceName?: string;
    description?: string | null;
    duration?: number;
    price?: number;
    availableDays?: string[];
    availableSlots?: string[];
}

/* ============================================================
   CREATE SERVICE
============================================================ */

export const createService = async (
    data: CreateServiceData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        SERVICES_TABLE_ID,
        ID.unique(),
        {
            userId: data.userId,
            serviceName: data.serviceName,
            description: data.description ?? null,
            duration: data.duration,
            price: data.price,
            availableDays: JSON.stringify(
                data.availableDays
            ),
            availableSlots: JSON.stringify(
                data.availableSlots
            ),
        },
        [
            Permission.read(Role.users()),
            Permission.update(Role.user(data.userId)),
            Permission.delete(Role.user(data.userId)),
        ]
    );
};

/* ============================================================
   GET ALL SERVICES
============================================================ */

export const getAllServices = async () => {
    return await databases.listDocuments(
        DATABASE_ID,
        SERVICES_TABLE_ID,
        [
            Query.orderDesc("$createdAt"),
        ]
    );
};

/* ============================================================
   GET SERVICES BY PROFESSIONAL
============================================================ */

export const getProfessionalServices = async (
    userId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        SERVICES_TABLE_ID,
        [
            Query.equal("userId", userId),
            Query.orderDesc("$createdAt"),
        ]
    );
};

/* ============================================================
   GET SINGLE SERVICE
============================================================ */

export const getServiceById = async (
    serviceId: string
) => {
    return await databases.getDocument(
        DATABASE_ID,
        SERVICES_TABLE_ID,
        serviceId
    );
};

/* ============================================================
   UPDATE SERVICE
============================================================ */

export const updateService = async (
    serviceId: string,
    data: UpdateServiceData
) => {
    const updateData: Record<string, unknown> = {};

    if (data.serviceName !== undefined) {
        updateData.serviceName = data.serviceName;
    }

    if (data.description !== undefined) {
        updateData.description =
            data.description ?? null;
    }

    if (data.duration !== undefined) {
        updateData.duration = data.duration;
    }

    if (data.price !== undefined) {
        updateData.price = data.price;
    }

    if (data.availableDays !== undefined) {
        updateData.availableDays = JSON.stringify(
            data.availableDays
        );
    }

    if (data.availableSlots !== undefined) {
        updateData.availableSlots = JSON.stringify(
            data.availableSlots
        );
    }

    return await databases.updateDocument(
        DATABASE_ID,
        SERVICES_TABLE_ID,
        serviceId,
        updateData
    );
};

/* ============================================================
   DELETE SERVICE
============================================================ */

export const deleteService = async (
    serviceId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        SERVICES_TABLE_ID,
        serviceId
    );
};