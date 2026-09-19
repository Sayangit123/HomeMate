import {
    Databases,
    ID,
    Query,
} from "appwrite";

import client from "./client";

const databases =
    new Databases(client);

const DATABASE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const COMPLAINTS_TABLE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_COMPLAINTS_TABLE_ID ||
    "complaints";

/* ============================================================
   TYPES
============================================================ */

export type ComplaintType =
    | "Customer Complaint"
    | "Professional Dispute"
    | "Booking Dispute";

export type ComplaintStatus =
    | "Pending"
    | "Under Review"
    | "Resolved"
    | "Rejected";

export interface Complaint {
    $id: string;
    $createdAt?: string;
    $updatedAt?: string;

    customerId: string;
    professionalId?: string | null;
    bookingId?: string | null;

    subject: string;
    complaintType: ComplaintType;
    description: string;

    status: ComplaintStatus;

    resolution?: string | null;
    resolvedBy?: string | null;
    resolvedAt?: string | null;
}

export interface CreateComplaintData {
    customerId: string;
    professionalId?: string;
    bookingId?: string;
    subject: string;
    complaintType: ComplaintType;
    description: string;
    status?: ComplaintStatus;
}

export interface UpdateComplaintData {
    status?: ComplaintStatus;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: string;
}

/* ============================================================
   GET ALL COMPLAINTS
============================================================ */

export const getAllComplaints =
    async () => {
        const response =
            await databases.listDocuments(
                DATABASE_ID,
                COMPLAINTS_TABLE_ID,
                [
                    Query.orderDesc(
                        "$createdAt"
                    ),
                ]
            );

        return response.documents as unknown as Complaint[];
    };

/* ============================================================
   GET SINGLE COMPLAINT
============================================================ */

export const getComplaintById =
    async (
        complaintId: string
    ) => {
        const response =
            await databases.getDocument(
                DATABASE_ID,
                COMPLAINTS_TABLE_ID,
                complaintId
            );

        return response as unknown as Complaint;
    };

/* ============================================================
   CREATE COMPLAINT
============================================================ */

export const createComplaint =
    async (
        data: CreateComplaintData
    ) => {
        const complaintData = {
            customerId:
                data.customerId,

            professionalId:
                data.professionalId || "",

            bookingId:
                data.bookingId || "",

            subject:
                data.subject,

            complaintType:
                data.complaintType,

            description:
                data.description,

            status:
                data.status ||
                "Pending",

            resolution: "",

            resolvedBy: "",

            resolvedAt: "",
        };

        const response =
            await databases.createDocument(
                DATABASE_ID,
                COMPLAINTS_TABLE_ID,
                ID.unique(),
                complaintData
            );

        return response as unknown as Complaint;
    };

/* ============================================================
   UPDATE COMPLAINT
============================================================ */

export const updateComplaint =
    async (
        complaintId: string,
        data: UpdateComplaintData
    ) => {
        const response =
            await databases.updateDocument(
                DATABASE_ID,
                COMPLAINTS_TABLE_ID,
                complaintId,
                data
            );

        return response as unknown as Complaint;
    };

/* ============================================================
   DELETE COMPLAINT
============================================================ */

export const deleteComplaint =
    async (
        complaintId: string
    ) => {
        await databases.deleteDocument(
            DATABASE_ID,
            COMPLAINTS_TABLE_ID,
            complaintId
        );

        return true;
    };

/* ============================================================
   UPDATE COMPLAINT STATUS
============================================================ */

export const updateComplaintStatus =
    async (
        complaintId: string,
        status: ComplaintStatus
    ) => {
        const data: UpdateComplaintData = {
            status,
        };

        /*
         * When a complaint is resolved or rejected,
         * we record the resolution time.
         */
        if (
            status === "Resolved" ||
            status === "Rejected"
        ) {
            data.resolvedAt =
                new Date().toISOString();
        }

        return await updateComplaint(
            complaintId,
            data
        );
    };