import {
    Databases,
    ID,
    Permission,
    Query,
    Role,
} from "appwrite";

import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const BOOKINGS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_BOOKINGS_TABLE_ID ||
    "bookings";

export type BookingStatus =
    | "Requested"
    | "Accepted"
    | "InProgress"
    | "Completed"
    | "Cancelled";

export interface CreateBookingData {
    customerId: string;
    professionalId: string;
    serviceId: string;
    propertyId: string;
    bookingDate: string;
    bookingTime: string;
    notes?: string | null;
}

export interface UpdateBookingData {
    bookingDate?: string;
    bookingTime?: string;
    notes?: string | null;
    status?: BookingStatus;
}

/**
 * Create a new booking
 */
export const createBooking = async (
    data: CreateBookingData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        ID.unique(),
        {
            customerId: data.customerId,
            professionalId: data.professionalId,
            serviceId: data.serviceId,
            propertyId: data.propertyId,
            bookingDate: data.bookingDate,
            bookingTime: data.bookingTime,
            status: "Requested",
            notes: data.notes ?? null,
        },
        [
            Permission.read(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.user(data.customerId)),
        ]
    );
};

/**
 * Get all bookings created by a customer
 */
export const getCustomerBookings = async (
    customerId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
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
 * Get all bookings received by a professional
 */
export const getProfessionalBookings = async (
    professionalId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        [
            Query.equal(
                "professionalId",
                professionalId
            ),
            Query.orderDesc("$createdAt"),
        ]
    );
};

/**
 * Get bookings for one professional on one date.
 *
 * Cancelled bookings are returned as well so that
 * the caller can explicitly ignore them.
 */
export const getProfessionalBookingsForDate = async (
    professionalId: string,
    bookingDate: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        [
            Query.equal(
                "professionalId",
                professionalId
            ),
            Query.equal(
                "bookingDate",
                bookingDate
            ),
            Query.orderAsc(
                "bookingTime"
            ),
        ]
    );
};

/**
 * Check whether a particular professional/date/time
 * is already booked.
 *
 * Cancelled bookings do NOT block the slot.
 */
export const getBookedSlot = async (
    professionalId: string,
    bookingDate: string,
    bookingTime: string
) => {
    const response =
        await databases.listDocuments(
            DATABASE_ID,
            BOOKINGS_TABLE_ID,
            [
                Query.equal(
                    "professionalId",
                    professionalId
                ),
                Query.equal(
                    "bookingDate",
                    bookingDate
                ),
                Query.equal(
                    "bookingTime",
                    bookingTime
                ),
                Query.limit(100),
            ]
        );

    const activeBooking =
        response.documents.find(
            (booking) =>
                booking.status !==
                "Cancelled"
        );

    return activeBooking || null;
};

/**
 * Get one booking by its document ID
 */
export const getBookingById = async (
    bookingId: string
) => {
    return await databases.getDocument(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        bookingId
    );
};

/**
 * Update a booking
 */
export const updateBooking = async (
    bookingId: string,
    data: UpdateBookingData
) => {
    const updateData: Record<
        string,
        unknown
    > = {};

    if (
        data.bookingDate !==
        undefined
    ) {
        updateData.bookingDate =
            data.bookingDate;
    }

    if (
        data.bookingTime !==
        undefined
    ) {
        updateData.bookingTime =
            data.bookingTime;
    }

    if (
        data.notes !==
        undefined
    ) {
        updateData.notes =
            data.notes ?? null;
    }

    if (
        data.status !==
        undefined
    ) {
        updateData.status =
            data.status;
    }

    return await databases.updateDocument(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        bookingId,
        updateData
    );
};

/**
 * Update only the booking status
 */
export const updateBookingStatus = async (
    bookingId: string,
    status: BookingStatus
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        bookingId,
        {
            status,
        }
    );
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (
    bookingId: string
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        bookingId,
        {
            status: "Cancelled",
        }
    );
};

/**
 * Delete a booking
 */
export const deleteBooking = async (
    bookingId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        BOOKINGS_TABLE_ID,
        bookingId
    );
};