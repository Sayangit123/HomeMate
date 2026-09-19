import { NextRequest, NextResponse } from "next/server";

import {
    Client,
    Databases,
    ID,
    Permission,
    Query,
    Role,
} from "node-appwrite";

const client = new Client();

client
    .setEndpoint(
        process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!
    )
    .setProject(
        process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!
    )
    .setKey(
        process.env.APPWRITE_API_KEY!
    );

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const BOOKINGS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_BOOKINGS_TABLE_ID ||
    "bookings";

const SERVICES_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_SERVICES_TABLE_ID ||
    "services";

const MEMBERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";

const NOTIFICATIONS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID ||
    "notifications";

/* =========================================================
   CREATE REMINDER FOR ONE BOOKING
========================================================= */

const createReminderForBooking = async (
    booking: any
) => {
    /* ================= CHECK BOOKING STATUS ================= */

    if (
        booking.status === "Cancelled" ||
        booking.status === "Completed"
    ) {
        return {
            skipped: true,
            reason: "Booking is cancelled or completed.",
        };
    }

    /* ================= GET SERVICE ================= */

    const service =
        await databases.getDocument(
            DATABASE_ID,
            SERVICES_TABLE_ID,
            booking.serviceId
        );

    /* ================= GET CUSTOMER ================= */

    const customerResponse =
        await databases.listDocuments(
            DATABASE_ID,
            MEMBERS_TABLE_ID,
            [
                Query.equal(
                    "userId",
                    booking.customerId
                ),
            ]
        );

    const customerName =
        customerResponse.documents.length > 0
            ? customerResponse.documents[0]
                  .fullName
            : "Customer";

    /* ================= CHECK DUPLICATE ================= */

    const existingReminders =
        await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_TABLE_ID,
            [
                Query.equal(
                    "referenceId",
                    booking.$id
                ),

                Query.equal(
                    "type",
                    "booking_reminder"
                ),
            ]
        );

    if (
        existingReminders.documents.length > 0
    ) {
        return {
            skipped: true,
            reason:
                "Reminder already exists.",
        };
    }

    /* ================= CUSTOMER REMINDER ================= */

    const customerReminder =
        await databases.createDocument(
            DATABASE_ID,
            NOTIFICATIONS_TABLE_ID,
            ID.unique(),
            {
                userId:
                    booking.customerId,

                title:
                    "Booking Reminder",

                message:
                    `Reminder: Your ${service.serviceName} booking is scheduled for ${booking.bookingDate} at ${booking.bookingTime}.`,

                type:
                    "booking_reminder",

                isRead:
                    false,

                referenceId:
                    booking.$id,
            },
            [
                Permission.read(
                    Role.user(
                        booking.customerId
                    )
                ),

                Permission.update(
                    Role.user(
                        booking.customerId
                    )
                ),

                Permission.delete(
                    Role.user(
                        booking.customerId
                    )
                ),
            ]
        );

    /* ================= PROFESSIONAL REMINDER ================= */

    const professionalReminder =
        await databases.createDocument(
            DATABASE_ID,
            NOTIFICATIONS_TABLE_ID,
            ID.unique(),
            {
                userId:
                    booking.professionalId,

                title:
                    "Upcoming Booking Reminder",

                message:
                    `Reminder: ${customerName} has a ${service.serviceName} booking scheduled for ${booking.bookingDate} at ${booking.bookingTime}.`,

                type:
                    "booking_reminder",

                isRead:
                    false,

                referenceId:
                    booking.$id,
            },
            [
                Permission.read(
                    Role.user(
                        booking.professionalId
                    )
                ),

                Permission.update(
                    Role.user(
                        booking.professionalId
                    )
                ),

                Permission.delete(
                    Role.user(
                        booking.professionalId
                    )
                ),
            ]
        );

    console.log(
        "CUSTOMER REMINDER CREATED:",
        customerReminder.$id
    );

    console.log(
        "PROFESSIONAL REMINDER CREATED:",
        professionalReminder.$id
    );

    return {
        success: true,

        customerReminderId:
            customerReminder.$id,

        professionalReminderId:
            professionalReminder.$id,
    };
};

/* =========================================================
   POST
   CREATE REMINDER FOR A SPECIFIC BOOKING
========================================================= */

export async function POST(
    request: NextRequest
) {
    try {
        const body =
            await request.json();

        const {
            bookingId,
        } = body;

        console.log(
            "BOOKING REMINDER REQUEST:",
            body
        );

        if (!bookingId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Booking ID is required.",
                },
                {
                    status: 400,
                }
            );
        }

        const booking =
            await databases.getDocument(
                DATABASE_ID,
                BOOKINGS_TABLE_ID,
                bookingId
            );

        const result =
            await createReminderForBooking(
                booking
            );

        return NextResponse.json(
            {
                success: true,
                bookingId,
                ...result,
            },
            {
                status: 200,
            }
        );
    } catch (error: unknown) {
        console.error(
            "BOOKING REMINDER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    "Failed to create booking reminder.",

                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            {
                status: 500,
            }
        );
    }
}

/* =========================================================
   GET
   CHECK UPCOMING BOOKINGS

   A booking is considered upcoming when it is within
   the next 24 hours.
========================================================= */

export async function GET() {
    try {
        console.log(
            "CHECKING UPCOMING BOOKINGS..."
        );

        const now =
            new Date();

        const next24Hours =
            new Date(
                now.getTime() +
                    24 *
                        60 *
                        60 *
                        1000
            );

        const bookingResponse =
            await databases.listDocuments(
                DATABASE_ID,
                BOOKINGS_TABLE_ID,
                [
                    Query.equal(
                        "status",
                        [
                            "Requested",
                            "Accepted",
                            "InProgress",
                        ]
                    ),
                    Query.limit(100),
                ]
            );

        const bookings =
            bookingResponse.documents;

        let createdCount = 0;
        let skippedCount = 0;

        for (
            const booking of bookings
        ) {
            try {
                /*
                 * Appwrite stores bookingDate as a
                 * datetime. We combine the stored
                 * booking date and booking time.
                 */

                const bookingDate =
                    new Date(
                        booking.bookingDate
                    );

                const [hours, minutes] =
                    String(
                        booking.bookingTime
                    )
                        .split(":")
                        .map(Number);

                bookingDate.setHours(
                    hours || 0,
                    minutes || 0,
                    0,
                    0
                );

                /*
                 * Only process bookings that are
                 * between NOW and the next 24 hours.
                 */

                if (
                    bookingDate > now &&
                    bookingDate <=
                        next24Hours
                ) {
                    console.log(
                        "UPCOMING BOOKING FOUND:",
                        booking.$id
                    );

                    const result =
                        await createReminderForBooking(
                            booking
                        );

                    if (
                        result.success
                    ) {
                        createdCount++;
                    } else {
                        skippedCount++;
                    }
                }
            } catch (bookingError) {
                console.error(
                    `Failed to process booking ${booking.$id}:`,
                    bookingError
                );
            }
        }

        return NextResponse.json(
            {
                success: true,

                message:
                    "Upcoming bookings checked successfully.",

                checkedBookings:
                    bookings.length,

                remindersCreated:
                    createdCount,

                remindersSkipped:
                    skippedCount,
            },
            {
                status: 200,
            }
        );
    } catch (error: unknown) {
        console.error(
            "UPCOMING BOOKINGS CHECK ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    "Failed to check upcoming bookings.",

                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            {
                status: 500,
            }
        );
    }
}