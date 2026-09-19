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

const PRODUCTS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_PRODUCTS_TABLE_ID ||
    "products";

export interface CreateProductData {
    businessId: string;
    productName: string;
    description?: string | null;
    category: string;
    price: number;
    stock: number;
    image?: string | null;
}

export interface UpdateProductData {
    productName?: string;
    description?: string | null;
    category?: string;
    price?: number;
    stock?: number;
    image?: string | null;
}

/**
 * Create a new marketplace product
 */
export const createProduct = async (
    data: CreateProductData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        PRODUCTS_TABLE_ID,
        ID.unique(),
        {
            businessId: data.businessId,
            productName: data.productName,
            description: data.description ?? null,
            category: data.category,
            price: data.price,
            stock: data.stock,
            image: data.image ?? null,
        },
        [
            Permission.read(Role.users()),
            Permission.update(
                Role.user(data.businessId)
            ),
            Permission.delete(
                Role.user(data.businessId)
            ),
        ]
    );
};

/**
 * Get all products
 */
export const getAllProducts = async () => {
    return await databases.listDocuments(
        DATABASE_ID,
        PRODUCTS_TABLE_ID,
        [
            Query.orderDesc("$createdAt"),
        ]
    );
};

/**
 * Get products created by a specific business
 */
export const getBusinessProducts = async (
    businessId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        PRODUCTS_TABLE_ID,
        [
            Query.equal(
                "businessId",
                businessId
            ),
            Query.orderDesc("$createdAt"),
        ]
    );
};

/**
 * Get a single product
 */
export const getProductById = async (
    productId: string
) => {
    return await databases.getDocument(
        DATABASE_ID,
        PRODUCTS_TABLE_ID,
        productId
    );
};

/**
 * Update a product
 */
export const updateProduct = async (
    productId: string,
    data: UpdateProductData
) => {
    const updateData: Record<
        string,
        unknown
    > = {};

    if (
        data.productName !== undefined
    ) {
        updateData.productName =
            data.productName;
    }

    if (
        data.description !== undefined
    ) {
        updateData.description =
            data.description ?? null;
    }

    if (
        data.category !== undefined
    ) {
        updateData.category =
            data.category;
    }

    if (data.price !== undefined) {
        updateData.price = data.price;
    }

    if (data.stock !== undefined) {
        updateData.stock = data.stock;
    }

    if (data.image !== undefined) {
        updateData.image =
            data.image ?? null;
    }

    return await databases.updateDocument(
        DATABASE_ID,
        PRODUCTS_TABLE_ID,
        productId,
        updateData
    );
};

/**
 * Delete a product
 */
export const deleteProduct = async (
    productId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        PRODUCTS_TABLE_ID,
        productId
    );
};