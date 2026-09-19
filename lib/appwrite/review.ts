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

const REVIEWS_TABLE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_REVIEWS_TABLE_ID ||
    "reviews";

export interface CreateReviewData {
    productId: string;
    customerId: string;
    rating: number;
    review?: string | null;
}

export interface UpdateReviewData {
    rating?: number;
    review?: string | null;
}

/* ================= CREATE REVIEW ================= */

export const createReview = async (
    data: CreateReviewData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        REVIEWS_TABLE_ID,
        ID.unique(),
        {
            productId:
                data.productId,
            customerId:
                data.customerId,
            rating:
                data.rating,
            review:
                data.review ?? null,
        },
        [
            Permission.read(
                Role.users()
            ),
            Permission.update(
                Role.user(
                    data.customerId
                )
            ),
            Permission.delete(
                Role.user(
                    data.customerId
                )
            ),
        ]
    );
};

/* ================= GET PRODUCT REVIEWS ================= */

export const getProductReviews = async (
    productId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        REVIEWS_TABLE_ID,
        [
            Query.equal(
                "productId",
                productId
            ),
            Query.orderDesc(
                "$createdAt"
            ),
        ]
    );
};

/* ================= GET CUSTOMER REVIEW ================= */

export const getCustomerProductReview =
    async (
        customerId: string,
        productId: string
    ) => {
        const response =
            await databases.listDocuments(
                DATABASE_ID,
                REVIEWS_TABLE_ID,
                [
                    Query.equal(
                        "customerId",
                        customerId
                    ),
                    Query.equal(
                        "productId",
                        productId
                    ),
                ]
            );

        return (
            response.documents[0] ||
            null
        );
    };

/* ================= UPDATE REVIEW ================= */

export const updateReview = async (
    reviewId: string,
    data: UpdateReviewData
) => {
    const updateData: Record<
        string,
        unknown
    > = {};

    if (
        data.rating !== undefined
    ) {
        updateData.rating =
            data.rating;
    }

    if (
        data.review !== undefined
    ) {
        updateData.review =
            data.review ?? null;
    }

    return await databases.updateDocument(
        DATABASE_ID,
        REVIEWS_TABLE_ID,
        reviewId,
        updateData
    );
};

/* ================= DELETE REVIEW ================= */

export const deleteReview = async (
    reviewId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        REVIEWS_TABLE_ID,
        reviewId
    );
};