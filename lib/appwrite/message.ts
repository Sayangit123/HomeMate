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

const MESSAGES_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_TABLE_ID ||
    "messages";

/* ================= MESSAGE INTERFACE ================= */

export interface CreateMessageData {
    senderId: string;
    receiverId: string;
    message: string;
    isRead?: boolean;
}

/* ================= CREATE MESSAGE ================= */

export const createMessage = async (
    data: CreateMessageData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        MESSAGES_TABLE_ID,
        ID.unique(),
        {
            senderId: data.senderId,
            receiverId: data.receiverId,
            message: data.message,
            isRead: data.isRead ?? false,
        },
        [
            /*
             * Anyone who is logged in can read messages.
             * This avoids assigning a permission to another
             * user's ID from the client-side SDK.
             */
            Permission.read(
                Role.users()
            ),

            /*
             * Sender can update the message.
             */
            Permission.update(
                Role.user(data.senderId)
            ),

            /*
             * Sender can delete the message.
             */
            Permission.delete(
                Role.user(data.senderId)
            ),
        ]
    );
};

/* ================= GET USER MESSAGES ================= */

export const getUserMessages = async (
    userId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        MESSAGES_TABLE_ID,
        [
            Query.equal(
                "receiverId",
                userId
            ),
            Query.orderDesc(
                "$createdAt"
            ),
        ]
    );
};

/* ================= GET CONVERSATION ================= */

export const getConversation = async (
    userId: string,
    otherUserId: string
) => {
    const response =
        await databases.listDocuments(
            DATABASE_ID,
            MESSAGES_TABLE_ID,
            [
                Query.or([
                    Query.and([
                        Query.equal(
                            "senderId",
                            userId
                        ),
                        Query.equal(
                            "receiverId",
                            otherUserId
                        ),
                    ]),
                    Query.and([
                        Query.equal(
                            "senderId",
                            otherUserId
                        ),
                        Query.equal(
                            "receiverId",
                            userId
                        ),
                    ]),
                ]),
                Query.orderAsc(
                    "$createdAt"
                ),
            ]
        );

    return response;
};

/* ================= MARK MESSAGE AS READ ================= */

export const markMessageAsRead = async (
    messageId: string
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        MESSAGES_TABLE_ID,
        messageId,
        {
            isRead: true,
        }
    );
};

/* ================= DELETE MESSAGE ================= */

export const deleteMessage = async (
    messageId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        MESSAGES_TABLE_ID,
        messageId
    );
};