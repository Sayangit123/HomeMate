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

const ORDER_ITEMS_TABLE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_ORDER_ITEMS_TABLE_ID ||
    "orderItems";

export interface CreateOrderItemData {
    orderId: string;
    productId: string;
    productName: string;
    productImage?: string | null;
    price: number;
    quantity: number;
}

export const createOrderItem = async (
    data: CreateOrderItemData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        ORDER_ITEMS_TABLE_ID,
        ID.unique(),
        {
            orderId: data.orderId,
            productId: data.productId,
            productName: data.productName,
            productImage:
                data.productImage ?? null,
            price: data.price,
            quantity: data.quantity,
        },
        [
            Permission.read(
                Role.users()
            ),
        ]
    );
};

export const getOrderItems = async (
    orderId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        ORDER_ITEMS_TABLE_ID,
        [
            Query.equal(
                "orderId",
                orderId
            ),
            Query.orderAsc(
                "$createdAt"
            ),
        ]
    );
};

export const getOrderItemById = async (
    orderItemId: string
) => {
    return await databases.getDocument(
        DATABASE_ID,
        ORDER_ITEMS_TABLE_ID,
        orderItemId
    );
};

export const deleteOrderItem = async (
    orderItemId: string
) => {
    return await databases.deleteDocument(
        DATABASE_ID,
        ORDER_ITEMS_TABLE_ID,
        orderItemId
    );
};