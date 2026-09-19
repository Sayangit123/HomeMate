import {
    Databases,
    ID,
    Query,
} from "appwrite";

import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const PAYMENTS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_PAYMENTS_TABLE_ID ||
    "payments";

/**
 * Payment status
 */
export type PaymentStatus =
    | "Pending"
    | "Completed"
    | "Failed"
    | "Refunded"
    | "Partially Refunded";

/**
 * Payment methods
 */
export type PaymentMethod =
    | "Card"
    | "UPI"
    | "Net Banking"
    | "Wallet"
    | "Cash";

/**
 * Payment document structure
 */
export interface Payment {
    $id: string;
    $createdAt: string;
    $updatedAt: string;

    customerId: string;

    bookingId?: string | null;

    orderId?: string | null;

    amount: number;

    paymentMethod: PaymentMethod | string;

    /**
     * IMPORTANT:
     * This matches the actual Appwrite column name.
     * Your column is "transcationId", not "transactionId".
     */
    transcationId: string;

    status: PaymentStatus | string;

    paymentDate: string;

    refundAmount?: number | null;
}

/**
 * Data required to create a payment
 */
export interface CreatePaymentData {
    customerId: string;

    bookingId?: string | null;

    orderId?: string | null;

    amount: number;

    paymentMethod: PaymentMethod | string;

    transcationId: string;

    status: PaymentStatus;

    paymentDate: string;

    refundAmount?: number | null;
}

/**
 * Data allowed when updating a payment
 */
export interface UpdatePaymentData {
    status?: PaymentStatus;

    refundAmount?: number | null;

    paymentMethod?: PaymentMethod | string;

    paymentDate?: string;
}

/**
 * Get all payments
 */
export const getAllPayments = async () => {
    return await databases.listDocuments(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        [
            Query.orderDesc("$createdAt"),
        ]
    );
};

/**
 * Get one payment by document ID
 */
export const getPaymentById = async (
    paymentId: string
) => {
    return await databases.getDocument(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        paymentId
    );
};

/**
 * Get all payments for a customer
 */
export const getCustomerPayments = async (
    customerId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        [
            Query.equal(
                "customerId",
                customerId
            ),
            Query.orderDesc("$createdAt"),
        ]
    );
};

/**
 * Get payment by booking ID
 */
export const getPaymentByBookingId = async (
    bookingId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        [
            Query.equal(
                "bookingId",
                bookingId
            ),
            Query.orderDesc("$createdAt"),
        ]
    );
};

/**
 * Get payment by order ID
 */
export const getPaymentByOrderId = async (
    orderId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        [
            Query.equal(
                "orderId",
                orderId
            ),
            Query.orderDesc("$createdAt"),
        ]
    );
};

/**
 * Create a payment
 */
export const createPayment = async (
    data: CreatePaymentData
) => {
    const paymentData: Record<
        string,
        unknown
    > = {
        customerId:
            data.customerId,

        amount:
            data.amount,

        paymentMethod:
            data.paymentMethod,

        transcationId:
            data.transcationId,

        status:
            data.status,

        paymentDate:
            data.paymentDate,
    };

    /**
     * Add bookingId only when provided
     */
    if (
        data.bookingId !== undefined &&
        data.bookingId !== null &&
        data.bookingId !== ""
    ) {
        paymentData.bookingId =
            data.bookingId;
    }

    /**
     * Add orderId only when provided
     */
    if (
        data.orderId !== undefined &&
        data.orderId !== null &&
        data.orderId !== ""
    ) {
        paymentData.orderId =
            data.orderId;
    }

    /**
     * Add refundAmount only when provided
     */
    if (
        data.refundAmount !== undefined &&
        data.refundAmount !== null
    ) {
        paymentData.refundAmount =
            data.refundAmount;
    }

    return await databases.createDocument(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        ID.unique(),
        paymentData
    );
};

/**
 * Update a payment
 */
export const updatePayment = async (
    paymentId: string,
    data: UpdatePaymentData
) => {
    const updateData: Record<
        string,
        unknown
    > = {};

    if (
        data.status !== undefined
    ) {
        updateData.status =
            data.status;
    }

    if (
        data.refundAmount !== undefined
    ) {
        updateData.refundAmount =
            data.refundAmount;
    }

    if (
        data.paymentMethod !== undefined
    ) {
        updateData.paymentMethod =
            data.paymentMethod;
    }

    if (
        data.paymentDate !== undefined
    ) {
        updateData.paymentDate =
            data.paymentDate;
    }

    return await databases.updateDocument(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        paymentId,
        updateData
    );
};

/**
 * Update only the payment status
 */
export const updatePaymentStatus = async (
    paymentId: string,
    status: PaymentStatus
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        PAYMENTS_TABLE_ID,
        paymentId,
        {
            status,
        }
    );
};