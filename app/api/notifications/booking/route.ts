import { NextRequest, NextResponse } from "next/server";

import {
    Client,
    Databases,
    ID,
    Permission,
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

const NOTIFICATIONS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID ||
    "notifications";

export async function POST(
    request: NextRequest
) {
    try {
        const body = await request.json();

        console.log(
            "BOOKING NOTIFICATION REQUEST:",
            body
        );

        const {
            customerId,
            professionalId,
            customerName,
            serviceName,
            bookingDate,
            bookingTime,
            bookingId,
        } = body;

        if (
            !customerId ||
            !professionalId ||
            !customerName ||
            !serviceName ||
            !bookingDate ||
            !bookingTime ||
            !bookingId
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Missing required notification data.",
                    received: body,
                },
                {
                    status: 400,
                }
            );
        }

        /*
         * ==========================================
         * CUSTOMER NOTIFICATION
         * ==========================================
         */

        const customerNotification =
            await databases.createDocument(
                DATABASE_ID,
                NOTIFICATIONS_TABLE_ID,
                ID.unique(),
                {
                    userId: customerId,

                    title:
                        "Booking Requested",

                    message:
                        `Your booking for ${serviceName} has been submitted successfully.`,

                    type:
                        "booking",

                    isRead:
                        false,

                    referenceId:
                        bookingId,
                },

                [
                    Permission.read(
                        Role.user(
                            customerId
                        )
                    ),

                    Permission.update(
                        Role.user(
                            customerId
                        )
                    ),

                    Permission.delete(
                        Role.user(
                            customerId
                        )
                    ),
                ]
            );

        console.log(
            "CUSTOMER NOTIFICATION CREATED:",
            customerNotification.$id
        );

        /*
         * ==========================================
         * PROFESSIONAL NOTIFICATION
         * ==========================================
         */

        const professionalNotification =
            await databases.createDocument(
                DATABASE_ID,
                NOTIFICATIONS_TABLE_ID,
                ID.unique(),
                {
                    userId:
                        professionalId,

                    title:
                        "New Booking Request",

                    message:
                        `${customerName} has requested your ${serviceName} service for ${bookingDate} at ${bookingTime}.`,

                    type:
                        "booking",

                    isRead:
                        false,

                    referenceId:
                        bookingId,
                },

                [
                    Permission.read(
                        Role.user(
                            professionalId
                        )
                    ),

                    Permission.update(
                        Role.user(
                            professionalId
                        )
                    ),

                    Permission.delete(
                        Role.user(
                            professionalId
                        )
                    ),
                ]
            );

        console.log(
            "PROFESSIONAL NOTIFICATION CREATED:",
            professionalNotification.$id
        );

        return NextResponse.json(
            {
                success: true,

                customerNotificationId:
                    customerNotification.$id,

                professionalNotificationId:
                    professionalNotification.$id,

                message:
                    "Booking notifications created successfully.",
            },
            {
                status: 200,
            }
        );
    } catch (error: unknown) {
        console.error(
            "===================================="
        );

        console.error(
            "BOOKING NOTIFICATION ERROR:"
        );

        console.error(error);

        console.error(
            "===================================="
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    "Failed to create booking notifications.",

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