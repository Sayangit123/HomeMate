import {
    Databases,
    ID,
    Query,
    Permission,
    Role,
} from "appwrite";

import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const CART_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_CART_TABLE_ID ||
    "cart";

export interface CreateCartItemData {
    customerId: string;
    productId: string;
    quantity: number;
}

export interface UpdateCartItemData {
    quantity: number;
}

/**
 * Add a new product to cart
 */
export const createCartItem = async (
    data: CreateCartItemData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        CART_TABLE_ID,
        ID.unique(),
        {
            customerId: data.customerId,
            productId: data.productId,
            quantity: data.quantity,
        },
        [
            Permission.read(
                Role.user(data.customerId)
            ),
            Permission.update(
                Role.user(data.customerId)
            ),
            Permission.delete(
                Role.user(data.customerId)
            ),
        ]
    );
};

/**
 * Get all cart items of a customer
 */
export const getCustomerCart = async (
    customerId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        CART_TABLE_ID,
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
 * Find a particular product inside customer's cart
 */
export const getCartItemByProduct = async (
    customerId: string,
    productId: string
) => {
    const response =
        await databases.listDocuments(
            DATABASE_ID,
            CART_TABLE_ID,
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

    return response.documents[0] || null;
};

/**
 * Update cart item quantity
 */
export const updateCartItem = async (
    cartItemId: string,
    data: UpdateCartItemData
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        CART_TABLE_ID,
        cartItemId,
        {
            quantity: data.quantity,
        }
    );
};

/**
 * Delete one cart item
 */
export const deleteCartItem = async (
    cartItemId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        CART_TABLE_ID,
        cartItemId
    );
};

/**
 * Clear customer's complete cart
 */
export const clearCustomerCart = async (
    customerId: string
) => {
    const response =
        await getCustomerCart(customerId);

    for (const item of response.documents) {
        await deleteCartItem(item.$id);
    }

    return true;
};