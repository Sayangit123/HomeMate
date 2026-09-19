import {
    Databases,
    ID,
    Query,
} from "appwrite";

import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const WARRANTIES_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_WARRANTIES_TABLE_ID ||
    "warranties";

/* ============================================================
   TYPES
============================================================ */

export type WarrantyStatus =
    | "Active"
    | "Expired"
    | "Claimed"
    | "Cancelled";

export interface CreateWarrantyData {
    bookingId: string;
    customerId: string;
    propertyId: string;
    serviceId: string;
    professionalId: string;
    warrantyPeriod: string;
    warrantyStartDate: string;
    warrantyExpiryDate: string;
    warrantyTerms?: string | null;
    status: WarrantyStatus;
}

export interface UpdateWarrantyData {
    warrantyPeriod?: string;
    warrantyStartDate?: string;
    warrantyExpiryDate?: string;
    warrantyTerms?: string | null;
    status?: WarrantyStatus;
}

/* ============================================================
   CREATE WARRANTY
============================================================ */

export const createWarranty = async (
    data: CreateWarrantyData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        WARRANTIES_TABLE_ID,
        ID.unique(),
        {
            bookingId: data.bookingId,
            customerId: data.customerId,
            propertyId: data.propertyId,
            serviceId: data.serviceId,
            professionalId: data.professionalId,
            warrantyPeriod: data.warrantyPeriod,
            warrantyStartDate:
                data.warrantyStartDate,
            warrantyExpiryDate:
                data.warrantyExpiryDate,
            warrantyTerms:
                data.warrantyTerms ?? null,
            status: data.status,
        }
    );
};

/* ============================================================
   GET WARRANTY BY ID
============================================================ */

export const getWarrantyById = async (
    warrantyId: string
) => {
    return await databases.getDocument(
        DATABASE_ID,
        WARRANTIES_TABLE_ID,
        warrantyId
    );
};

/* ============================================================
   GET WARRANTY BY BOOKING
============================================================ */

export const getWarrantyByBookingId =
    async (
        bookingId: string
    ) => {
        const response =
            await databases.listDocuments(
                DATABASE_ID,
                WARRANTIES_TABLE_ID,
                [
                    Query.equal(
                        "bookingId",
                        bookingId
                    ),
                    Query.limit(1),
                ]
            );

        return response.documents[0] || null;
    };

/* ============================================================
   GET CUSTOMER WARRANTIES
============================================================ */

export const getCustomerWarranties =
    async (
        customerId: string
    ) => {
        return await databases.listDocuments(
            DATABASE_ID,
            WARRANTIES_TABLE_ID,
            [
                Query.equal(
                    "customerId",
                    customerId
                ),
                Query.limit(100),
            ]
        );
    };

/* ============================================================
   GET PROPERTY WARRANTIES
============================================================ */

export const getPropertyWarranties =
    async (
        propertyId: string
    ) => {
        return await databases.listDocuments(
            DATABASE_ID,
            WARRANTIES_TABLE_ID,
            [
                Query.equal(
                    "propertyId",
                    propertyId
                ),
                Query.orderDesc(
                    "warrantyExpiryDate"
                ),
            ]
        );
    };

/* ============================================================
   GET PROFESSIONAL WARRANTIES
============================================================ */

export const getProfessionalWarranties =
    async (
        professionalId: string
    ) => {
        return await databases.listDocuments(
            DATABASE_ID,
            WARRANTIES_TABLE_ID,
            [
                Query.equal(
                    "professionalId",
                    professionalId
                ),
                Query.orderDesc(
                    "warrantyExpiryDate"
                ),
            ]
        );
    };

/* ============================================================
   GET ACTIVE WARRANTIES
============================================================ */

export const getActiveWarranties =
    async (
        customerId: string
    ) => {
        return await databases.listDocuments(
            DATABASE_ID,
            WARRANTIES_TABLE_ID,
            [
                Query.equal(
                    "customerId",
                    customerId
                ),
                Query.equal(
                    "status",
                    "Active"
                ),
                Query.orderAsc(
                    "warrantyExpiryDate"
                ),
            ]
        );
    };

/* ============================================================
   UPDATE WARRANTY
============================================================ */

export const updateWarranty = async (
    warrantyId: string,
    data: UpdateWarrantyData
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        WARRANTIES_TABLE_ID,
        warrantyId,
        {
            ...data,
        }
    );
};

/* ============================================================
   UPDATE WARRANTY STATUS
============================================================ */

export const updateWarrantyStatus =
    async (
        warrantyId: string,
        status: WarrantyStatus
    ) => {
        return await databases.updateDocument(
            DATABASE_ID,
            WARRANTIES_TABLE_ID,
            warrantyId,
            {
                status,
            }
        );
    };

/* ============================================================
   DELETE WARRANTY
============================================================ */

export const deleteWarranty = async (
    warrantyId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        WARRANTIES_TABLE_ID,
        warrantyId
    );
};