"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { getOrderById } from "@/lib/appwrite/order";
import { getOrderItems } from "@/lib/appwrite/orderItem";

interface Order {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    customerId: string;
    totalAmount: number;
    status: string;
    shippingAddress: string;
    paymentStatus: string;
}

interface OrderItem {
    $id: string;
    orderId: string;
    productId: string;
    productName: string;
    productImage?: string | null;
    price: number;
    quantity: number;
    $createdAt?: string;
}

const orderStatuses = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
];

export default function OrderDetailsPage() {
    const router = useRouter();

    const [order, setOrder] =
        useState<Order | null>(null);

    const [orderItems, setOrderItems] =
        useState<OrderItem[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [orderId, setOrderId] =
        useState("");

    const loadOrder = async () => {
        try {
            setLoading(true);

            const path =
                window.location.pathname;

            const parts =
                path.split("/");

            const currentOrderId =
                parts[parts.length - 1];

            if (
                !currentOrderId ||
                currentOrderId === "orders"
            ) {
                throw new Error(
                    "Order ID not found."
                );
            }

            setOrderId(currentOrderId);

            /* ---------------- ORDER ---------------- */

            const orderResponse =
                await getOrderById(
                    currentOrderId
                );

            setOrder(
                orderResponse as unknown as Order
            );

            /* ---------------- ORDER ITEMS ---------------- */

            const itemsResponse =
                await getOrderItems(
                    currentOrderId
                );

            setOrderItems(
                itemsResponse.documents as unknown as OrderItem[]
            );
        } catch (error) {
            console.error(
                "Failed to load order:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Order Not Found",
                text:
                    "Unable to load this order.",
                confirmButtonColor:
                    "#0f172a",
            });

            router.push(
                "/dashboard/marketplace"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrder();
    }, []);

    const getStatusIndex = () => {
        if (!order) {
            return -1;
        }

        return orderStatuses.indexOf(
            order.status
        );
    };

    const statusIndex =
        getStatusIndex();

    const formatDate = (
        dateString: string
    ) => {
        if (!dateString) {
            return "N/A";
        }

        return new Date(
            dateString
        ).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getPaymentStyle = () => {
        if (
            order?.paymentStatus ===
            "Paid"
        ) {
            return "bg-green-100 text-green-700";
        }

        if (
            order?.paymentStatus ===
            "Failed"
        ) {
            return "bg-red-100 text-red-700";
        }

        if (
            order?.paymentStatus ===
            "Refunded"
        ) {
            return "bg-purple-100 text-purple-700";
        }

        return "bg-yellow-100 text-yellow-700";
    };

    const getOrderStatusStyle = () => {
        if (
            order?.status ===
            "Delivered"
        ) {
            return "bg-green-100 text-green-700";
        }

        if (
            order?.status ===
            "Cancelled"
        ) {
            return "bg-red-100 text-red-700";
        }

        return "bg-blue-100 text-blue-700";
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>

                    <p className="text-slate-600 text-sm">
                        Loading order details...
                    </p>
                </div>
            </main>
        );
    }

    if (!order) {
        return null;
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
            <div className="max-w-6xl mx-auto">

                {/* ================= HEADER ================= */}

                <div className="mb-8">
                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/marketplace/orders"
                            )
                        }
                        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition mb-5"
                    >
                        ← Back to My Orders
                    </button>

                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-2">
                                Marketplace Order
                            </p>

                            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                                Order Details
                            </h1>

                            <p className="text-sm text-slate-500 mt-2 break-all">
                                Order ID:{" "}
                                <span className="font-medium text-slate-700">
                                    {orderId}
                                </span>
                            </p>
                        </div>

                        <div
                            className={`inline-flex items-center self-start md:self-auto px-4 py-2 text-sm font-semibold ${getOrderStatusStyle()}`}
                        >
                            {order.status}
                        </div>
                    </div>
                </div>

                {/* ================= MAIN GRID ================= */}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ================= LEFT ================= */}

                    <div className="lg:col-span-2 space-y-6">

                        {/* ================= ORDER ITEMS ================= */}

                        <section className="bg-white border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        Ordered Products
                                    </h2>

                                    <p className="text-sm text-slate-500 mt-1">
                                        Products included in this order
                                    </p>
                                </div>

                                <span className="text-2xl">
                                    🛍️
                                </span>
                            </div>

                            {orderItems.length ===
                            0 ? (
                                <div className="border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                                    <div className="text-4xl mb-3">
                                        📦
                                    </div>

                                    <p className="text-sm font-semibold text-slate-700">
                                        No order items found
                                    </p>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Product details are not available for this order.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {orderItems.map(
                                        (
                                            item
                                        ) => (
                                            <div
                                                key={
                                                    item.$id
                                                }
                                                className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0"
                                            >
                                                <div className="flex flex-col sm:flex-row gap-5">

                                                    {/* PRODUCT IMAGE */}

                                                    <div className="w-full sm:w-32 h-32 bg-slate-100 flex-shrink-0 overflow-hidden">
                                                        {item.productImage ? (
                                                            <img
                                                                src={
                                                                    item.productImage
                                                                }
                                                                alt={
                                                                    item.productName
                                                                }
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <div className="text-center">
                                                                    <div className="text-4xl">
                                                                        📦
                                                                    </div>

                                                                    <p className="text-xs text-slate-400 mt-1">
                                                                        No Image
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* PRODUCT DETAILS */}

                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                            Product
                                                        </p>

                                                        <h3 className="text-lg font-bold text-slate-900 mt-1">
                                                            {
                                                                item.productName
                                                            }
                                                        </h3>

                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">

                                                            <div>
                                                                <p className="text-xs text-slate-400">
                                                                    Price
                                                                </p>

                                                                <p className="text-sm font-semibold text-slate-800 mt-1">
                                                                    ₹
                                                                    {item.price.toLocaleString(
                                                                        "en-IN"
                                                                    )}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs text-slate-400">
                                                                    Quantity
                                                                </p>

                                                                <p className="text-sm font-semibold text-slate-800 mt-1">
                                                                    {
                                                                        item.quantity
                                                                    }
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs text-slate-400">
                                                                    Item Total
                                                                </p>

                                                                <p className="text-sm font-bold text-slate-900 mt-1">
                                                                    ₹
                                                                    {(
                                                                        item.price *
                                                                        item.quantity
                                                                    ).toLocaleString(
                                                                        "en-IN"
                                                                    )}
                                                                </p>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </section>

                        {/* ================= ORDER TRACKING ================= */}

                        <section className="bg-white border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        Order Tracking
                                    </h2>

                                    <p className="text-sm text-slate-500 mt-1">
                                        Track the current status of your order.
                                    </p>
                                </div>

                                <span className="text-2xl">
                                    🚚
                                </span>
                            </div>

                            {order.status ===
                            "Cancelled" ? (
                                <div className="border border-red-200 bg-red-50 p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="text-2xl">
                                            ❌
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-red-800">
                                                Order Cancelled
                                            </h3>

                                            <p className="text-sm text-red-700 mt-1">
                                                This order has been cancelled.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-7">
                                    {orderStatuses.map(
                                        (
                                            status,
                                            index
                                        ) => {
                                            const isCompleted =
                                                index <=
                                                statusIndex;

                                            const isCurrent =
                                                status ===
                                                order.status;

                                            return (
                                                <div
                                                    key={
                                                        status
                                                    }
                                                    className="flex items-start gap-4"
                                                >
                                                    {/* STATUS CIRCLE */}

                                                    <div className="flex flex-col items-center">
                                                        <div
                                                            className={`w-10 h-10 flex items-center justify-center text-sm font-bold border-2 ${
                                                                isCompleted
                                                                    ? "bg-slate-900 border-slate-900 text-white"
                                                                    : "bg-white border-slate-300 text-slate-400"
                                                            }`}
                                                        >
                                                            {isCompleted
                                                                ? "✓"
                                                                : index +
                                                                  1}
                                                        </div>

                                                        {index <
                                                            orderStatuses.length -
                                                                1 && (
                                                            <div
                                                                className={`w-0.5 h-10 ${
                                                                    index <
                                                                    statusIndex
                                                                        ? "bg-slate-900"
                                                                        : "bg-slate-200"
                                                                }`}
                                                            ></div>
                                                        )}
                                                    </div>

                                                    {/* STATUS DETAILS */}

                                                    <div className="pt-1">
                                                        <h3
                                                            className={`font-semibold ${
                                                                isCurrent
                                                                    ? "text-slate-900"
                                                                    : isCompleted
                                                                    ? "text-slate-700"
                                                                    : "text-slate-400"
                                                            }`}
                                                        >
                                                            {
                                                                status
                                                            }
                                                        </h3>

                                                        <p className="text-sm text-slate-500 mt-1">
                                                            {status ===
                                                                "Pending" &&
                                                                "Your order has been placed and is awaiting confirmation."}

                                                            {status ===
                                                                "Confirmed" &&
                                                                "Your order has been confirmed."}

                                                            {status ===
                                                                "Processing" &&
                                                                "Your order is currently being prepared."}

                                                            {status ===
                                                                "Shipped" &&
                                                                "Your order has been shipped."}

                                                            {status ===
                                                                "Delivered" &&
                                                                "Your order has been delivered successfully."}
                                                        </p>

                                                        {isCurrent && (
                                                            <span className="inline-block mt-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1">
                                                                Current Status
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </section>

                        {/* ================= SHIPPING ADDRESS ================= */}

                        <section className="bg-white border border-slate-200 p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-slate-100 flex items-center justify-center text-lg">
                                    📍
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        Shipping Address
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Delivery address for this order
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 p-5">
                                <p className="text-slate-700 whitespace-pre-wrap leading-7">
                                    {
                                        order.shippingAddress
                                    }
                                </p>
                            </div>
                        </section>

                        {/* ================= ORDER INFORMATION ================= */}

                        <section className="bg-white border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-900 mb-5">
                                Order Information
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                        Order ID
                                    </p>

                                    <p className="text-sm font-medium text-slate-700 break-all">
                                        {
                                            order.$id
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                        Order Date
                                    </p>

                                    <p className="text-sm font-medium text-slate-700">
                                        {formatDate(
                                            order.$createdAt
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                        Last Updated
                                    </p>

                                    <p className="text-sm font-medium text-slate-700">
                                        {formatDate(
                                            order.$updatedAt
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                        Customer ID
                                    </p>

                                    <p className="text-sm font-medium text-slate-700 break-all">
                                        {
                                            order.customerId
                                        }
                                    </p>
                                </div>

                            </div>
                        </section>
                    </div>

                    {/* ================= RIGHT ================= */}

                    <div className="space-y-6">

                        {/* ORDER SUMMARY */}

                        <section className="bg-white border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">
                                Order Summary
                            </h2>

                            <div className="space-y-4">

                                <div className="flex justify-between gap-4">
                                    <span className="text-sm text-slate-500">
                                        Products
                                    </span>

                                    <span className="font-semibold text-slate-900">
                                        {
                                            orderItems.length
                                        }
                                    </span>
                                </div>

                                <div className="flex justify-between gap-4">
                                    <span className="text-sm text-slate-500">
                                        Total Quantity
                                    </span>

                                    <span className="font-semibold text-slate-900">
                                        {orderItems.reduce(
                                            (
                                                total,
                                                item
                                            ) =>
                                                total +
                                                item.quantity,
                                            0
                                        )}
                                    </span>
                                </div>

                                <div className="border-t border-slate-200 pt-4 flex justify-between gap-4">
                                    <span className="font-semibold text-slate-900">
                                        Total
                                    </span>

                                    <span className="text-xl font-bold text-slate-900">
                                        ₹
                                        {order.totalAmount.toLocaleString(
                                            "en-IN"
                                        )}
                                    </span>
                                </div>

                            </div>
                        </section>

                        {/* PAYMENT STATUS */}

                        <section className="bg-white border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-900 mb-5">
                                Payment
                            </h2>

                            <div className="flex items-center justify-between gap-4">

                                <div>
                                    <p className="text-sm text-slate-500">
                                        Payment Status
                                    </p>

                                    <p className="text-sm font-semibold text-slate-800 mt-1">
                                        {
                                            order.paymentStatus
                                        }
                                    </p>
                                </div>

                                <span
                                    className={`px-3 py-1 text-xs font-semibold ${getPaymentStyle()}`}
                                >
                                    {
                                        order.paymentStatus
                                    }
                                </span>

                            </div>
                        </section>

                        {/* CURRENT STATUS */}

                        <section className="bg-slate-900 text-white p-6">
                            <p className="text-sm text-slate-400 mb-2">
                                Current Order Status
                            </p>

                            <h2 className="text-2xl font-bold">
                                {order.status}
                            </h2>

                            <p className="text-sm text-slate-300 mt-3 leading-6">
                                {order.status ===
                                    "Pending" &&
                                    "Your order has been successfully placed and is waiting for confirmation."}

                                {order.status ===
                                    "Confirmed" &&
                                    "The business has confirmed your order."}

                                {order.status ===
                                    "Processing" &&
                                    "Your order is being prepared."}

                                {order.status ===
                                    "Shipped" &&
                                    "Your order is on the way."}

                                {order.status ===
                                    "Delivered" &&
                                    "Your order has been delivered."}

                                {order.status ===
                                    "Cancelled" &&
                                    "This order has been cancelled."}
                            </p>
                        </section>

                        {/* CONTINUE SHOPPING */}

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace"
                                )
                            }
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 transition"
                        >
                            Continue Shopping
                        </button>

                        {/* BACK TO ORDERS */}

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace/orders"
                                )
                            }
                            className="w-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-semibold py-3.5 transition"
                        >
                            View All Orders
                        </button>

                    </div>
                </div>
            </div>
        </main>
    );
}