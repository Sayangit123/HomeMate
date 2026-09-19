import {
    Databases,
    ID,
    Query,
} from "appwrite";

import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const NOTIFICATIONS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID ||
    "notifications";

/* ================= NOTIFICATION INTERFACE ================= */

export interface CreateNotificationData {
    userId: string;
    title: string;
    message: string;
    type: string;
    isRead?: boolean;
    referenceId?: string | null;
}

/* ================= CREATE NOTIFICATION ================= */

export const createNotification = async (
    data: CreateNotificationData
) => {
    /*
     * Do not manually assign Permission.user()
     * here.
     *
     * The Notifications table already has
     * Users permissions enabled, and Row Security
     * is OFF.
     *
     * Appwrite was rejecting the request because
     * a client user cannot grant another user's
     * document permission.
     */

    return await databases.createDocument(
        DATABASE_ID,
        NOTIFICATIONS_TABLE_ID,
        ID.unique(),
        {
            userId: data.userId,
            title: data.title,
            message: data.message,
            type: data.type,
            isRead: data.isRead ?? false,
            referenceId:
                data.referenceId ?? null,
        }
    );
};

/* ================= GET USER NOTIFICATIONS ================= */

export const getUserNotifications = async (
    userId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        NOTIFICATIONS_TABLE_ID,
        [
            Query.equal(
                "userId",
                userId
            ),
            Query.orderDesc(
                "$createdAt"
            ),
        ]
    );
};

/* ================= GET UNREAD NOTIFICATIONS ================= */

export const getUnreadNotifications =
    async (
        userId: string
    ) => {
        return await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_TABLE_ID,
            [
                Query.equal(
                    "userId",
                    userId
                ),
                Query.equal(
                    "isRead",
                    false
                ),
                Query.orderDesc(
                    "$createdAt"
                ),
            ]
        );
    };

/* ================= MARK ONE AS READ ================= */

export const markNotificationAsRead =
    async (
        notificationId: string
    ) => {
        return await databases.updateDocument(
            DATABASE_ID,
            NOTIFICATIONS_TABLE_ID,
            notificationId,
            {
                isRead: true,
            }
        );
    };

/* ================= MARK ALL AS READ ================= */

export const markAllNotificationsAsRead =
    async (
        userId: string
    ) => {
        const response =
            await getUnreadNotifications(
                userId
            );

        for (
            const notification of response.documents
        ) {
            await markNotificationAsRead(
                notification.$id
            );
        }

        return true;
    };

/* ================= DELETE NOTIFICATION ================= */

export const deleteNotification = async (
    notificationId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        NOTIFICATIONS_TABLE_ID,
        notificationId
    );
};