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

const ORDERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_ORDERS_TABLE_ID ||
    "orders";

export interface CreateOrderData {
    customerId: string;
    totalAmount: number;
    status: string;
    shippingAddress: string;
    paymentStatus: string;
}

/**
 * Create a new order
 */
export const createOrder = async (
    data: CreateOrderData
) => {
    return await databases.createDocument(
        DATABASE_ID,
        ORDERS_TABLE_ID,
        ID.unique(),
        {
            customerId:
                data.customerId,
            totalAmount:
                data.totalAmount,
            status:
                data.status,
            shippingAddress:
                data.shippingAddress,
            paymentStatus:
                data.paymentStatus,
        },
        [
            Permission.read(
                Role.user(
                    data.customerId
                )
            ),
            Permission.update(
                Role.user(
                    data.customerId
                )
            ),
        ]
    );
};

/**
 * Get all orders of a customer
 */
export const getCustomerOrders = async (
    customerId: string
) => {
    return await databases.listDocuments(
        DATABASE_ID,
        ORDERS_TABLE_ID,
        [
            Query.equal(
                "customerId",
                customerId
            ),
            Query.orderDesc(
                "$createdAt"
            ),
        ]
    );
};

/**
 * Get a single order
 */
export const getOrderById = async (
    orderId: string
) => {
    return await databases.getDocument(
        DATABASE_ID,
        ORDERS_TABLE_ID,
        orderId
    );
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
    orderId: string,
    status: string
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        ORDERS_TABLE_ID,
        orderId,
        {
            status,
        }
    );
};

/**
 * Update payment status
 */
export const updatePaymentStatus = async (
    orderId: string,
    paymentStatus: string
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        ORDERS_TABLE_ID,
        orderId,
        {
            paymentStatus,
        }
    );
};

/**
 * Cancel an order
 */
export const cancelOrder = async (
    orderId: string
) => {
    return await databases.updateDocument(
        DATABASE_ID,
        ORDERS_TABLE_ID,
        orderId,
        {
            status: "Cancelled",
        }
    );
};