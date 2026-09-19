import {
    Databases,
    Query,
    Storage,
} from "appwrite";

import client from "./client";

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MEMBERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";

const PROFILE_BUCKET_ID =
    process.env.NEXT_PUBLIC_APPWRITE_PROFILE_BUCKET_ID ||
    "home-mate-profiles";

/* ================= MEMBER INTERFACE ================= */

export interface Member {
    $id: string;
    userId: string;
    fullName: string;
    phone?: string | null;
    role:
        | "customer"
        | "professional"
        | "business";
    profileImage?: string | null;
    profileCompletion: number;
    verificationStatus: string;
}

/* ================= GET ALL MEMBERS ================= */

export const getAllMembers = async () => {
    return await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_TABLE_ID,
        [
            Query.orderAsc(
                "fullName"
            ),
        ]
    );
};

/* ================= GET MEMBER BY USER ID ================= */

export const getMemberByUserId = async (
    userId: string
) => {
    const response =
        await databases.listDocuments(
            DATABASE_ID,
            MEMBERS_TABLE_ID,
            [
                Query.equal(
                    "userId",
                    userId
                ),
            ]
        );

    return (
        response.documents[0] || null
    );
};

/* ================= GET MEMBERS BY ROLE ================= */

export const getMembersByRole = async (
    role: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_TABLE_ID,
        [
            Query.equal(
                "role",
                role
            ),
            Query.orderAsc(
                "fullName"
            ),
        ]
    );
};

/* ================= GET PROFILE IMAGE URL ================= */

export const getProfileImageUrl = (
    fileId?: string | null
) => {
    if (!fileId) {
        return "";
    }

    /*
     * If profileImage is already a complete
     * URL, use it directly.
     */

    if (
        fileId.startsWith("http://") ||
        fileId.startsWith("https://")
    ) {
        return fileId;
    }

    /*
     * Otherwise profileImage is an
     * Appwrite Storage file ID.
     */

    try {
        return storage
            .getFileView(
                PROFILE_BUCKET_ID,
                fileId
            )
            .toString();
    } catch (error) {
        console.error(
            "Unable to generate profile image URL:",
            error
        );

        return "";
    }
};