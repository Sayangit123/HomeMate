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

const ORDERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_ORDERS_TABLE_ID ||
    "orders";

const NOTIFICATIONS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID ||
    "notifications";

/* =========================================================
   POST ORDER NOTIFICATION
========================================================= */

export async function POST(
    request: NextRequest
) {
    try {
        const body = await request.json();

        console.log(
            "ORDER NOTIFICATION REQUEST:",
            body
        );

        const {
            customerId,
            orderId,
            status,
        } = body;

        /* ================= VALIDATION ================= */

        if (
            !customerId ||
            !orderId ||
            !status
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Customer ID, Order ID and status are required.",
                    received: body,
                },
                {
                    status: 400,
                }
            );
        }

        /* ================= GET ORDER ================= */

        const order =
            await databases.getDocument(
                DATABASE_ID,
                ORDERS_TABLE_ID,
                orderId
            );

        /* ================= VERIFY CUSTOMER ================= */

        if (
            order.customerId !==
            customerId
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This order does not belong to the customer.",
                },
                {
                    status: 403,
                }
            );
        }

        /* ================= CHECK DUPLICATE ================= */

        const existingNotifications =
            await databases.listDocuments(
                DATABASE_ID,
                NOTIFICATIONS_TABLE_ID,
                [
                    Query.equal(
                        "referenceId",
                        orderId
                    ),

                    Query.equal(
                        "type",
                        "order"
                    ),

                    Query.equal(
                        "userId",
                        customerId
                    ),
                ]
            );

        /*
         * We allow different notifications for
         * different order statuses.
         *
         * Example:
         *
         * Order Placed
         * Order Confirmed
         * Order Shipped
         *
         * Therefore we check the status inside
         * the notification message/title below.
         */

        const statusAlreadyNotified =
            existingNotifications.documents.some(
                (
                    notification: any
                ) =>
                    notification.message?.includes(
                        `Status: ${status}`
                    )
            );

        if (
            statusAlreadyNotified
        ) {
            return NextResponse.json(
                {
                    success: true,
                    alreadyCreated: true,
                    message:
                        "This order status notification already exists.",
                },
                {
                    status: 200,
                }
            );
        }

        /* ================= NOTIFICATION CONTENT ================= */

        let title =
            "Order Update";

        let message =
            `Your order status has been updated to ${status}.`;

        switch (status) {
            case "Pending":
                title =
                    "Order Placed";

                message =
                    `Your order #${orderId} has been placed successfully and is currently pending.`;

                break;

            case "Confirmed":
                title =
                    "Order Confirmed";

                message =
                    `Your order #${orderId} has been confirmed successfully.`;

                break;

            case "Processing":
                title =
                    "Order Processing";

                message =
                    `Your order #${orderId} is now being prepared.`;

                break;

            case "Shipped":
                title =
                    "Order Shipped";

                message =
                    `Your order #${orderId} has been shipped and is on the way.`;

                break;

            case "Delivered":
                title =
                    "Order Delivered";

                message =
                    `Your order #${orderId} has been delivered successfully.`;

                break;

            case "Cancelled":
                title =
                    "Order Cancelled";

                message =
                    `Your order #${orderId} has been cancelled.`;

                break;

            default:
                title =
                    "Order Status Updated";

                message =
                    `Your order #${orderId} status is now ${status}.`;
        }

        /*
         * Add the status marker so that we can identify
         * whether this particular status notification
         * has already been created.
         */

        message =
            `${message} Status: ${status}`;

        /* ================= CREATE NOTIFICATION ================= */

        const notification =
            await databases.createDocument(
                DATABASE_ID,
                NOTIFICATIONS_TABLE_ID,
                ID.unique(),
                {
                    userId:
                        customerId,

                    title,

                    message,

                    type:
                        "order",

                    isRead:
                        false,

                    referenceId:
                        orderId,
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
            "ORDER NOTIFICATION CREATED:",
            notification.$id
        );

        /* ================= SUCCESS ================= */

        return NextResponse.json(
            {
                success: true,

                notificationId:
                    notification.$id,

                message:
                    "Order notification created successfully.",
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
            "ORDER NOTIFICATION ERROR:"
        );

        console.error(error);

        console.error(
            "===================================="
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    "Failed to create order notification.",

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