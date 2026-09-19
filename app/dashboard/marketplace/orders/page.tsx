"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";

import { getCurrentUser } from "@/lib/appwrite/account";
import { getCustomerOrders } from "@/lib/appwrite/order";
import { getOrderItems } from "@/lib/appwrite/orderItem";

import { useOrdersStore } from "@/lib/stores/orders-store";

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
}

interface OrdersData {
    orders: Order[];
    orderItems: Record<string, OrderItem[]>;
}

export default function OrdersPage() {
    const router = useRouter();

    /*
     * ============================================================
     * ZUSTAND
     * ============================================================
     */

    const {
        setSelectedOrderId,
    } = useOrdersStore();

    /*
     * ============================================================
     * TANSTACK QUERY
     * ============================================================
     *
     * Orders and order items are server data, so they are
     * managed by TanStack Query.
     */

    const {
        data,
        isLoading: loading,
    } = useQuery({
        queryKey: ["marketplace-orders"],

        queryFn: async (): Promise<OrdersData> => {
            try {
                const user =
                    await getCurrentUser();

                const response =
                    await getCustomerOrders(
                        user.$id
                    );

                const customerOrders =
                    response.documents as unknown as Order[];

                const itemsMap: Record<
                    string,
                    OrderItem[]
                > = {};

                /*
                 * Load all order items in parallel.
                 */

                await Promise.all(
                    customerOrders.map(
                        async (order) => {
                            try {
                                const itemsResponse =
                                    await getOrderItems(
                                        order.$id
                                    );

                                itemsMap[
                                    order.$id
                                ] =
                                    itemsResponse.documents as unknown as OrderItem[];
                            } catch (error) {
                                console.error(
                                    `Failed to load items for order ${order.$id}:`,
                                    error
                                );

                                itemsMap[
                                    order.$id
                                ] = [];
                            }
                        }
                    )
                );

                return {
                    orders:
                        customerOrders,
                    orderItems:
                        itemsMap,
                };
            } catch (error) {
                console.error(
                    "Failed to load orders:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Unable to Load Orders",
                    text:
                        "Something went wrong while loading your marketplace orders.",
                    confirmButtonColor:
                        "#0f172a",
                });

                throw error;
            }
        },

        staleTime: 30 * 1000,
    });

    const orders =
        data?.orders ?? [];

    const orderItems =
        data?.orderItems ?? {};

    /*
     * ============================================================
     * FORMAT DATE
     * ============================================================
     */

    const formatDate = (
        dateString: string
    ) => {
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

    /*
     * ============================================================
     * ORDER STATUS CLASS
     * ============================================================
     */

    const getStatusClass = (
        status: string
    ) => {
        switch (status) {
            case "Delivered":
                return "bg-green-100 text-green-700";

            case "Cancelled":
                return "bg-red-100 text-red-700";

            case "Shipped":
                return "bg-purple-100 text-purple-700";

            case "Processing":
                return "bg-blue-100 text-blue-700";

            case "Confirmed":
                return "bg-cyan-100 text-cyan-700";

            default:
                return "bg-yellow-100 text-yellow-700";
        }
    };

    /*
     * ============================================================
     * PAYMENT STATUS CLASS
     * ============================================================
     */

    const getPaymentClass = (
        status: string
    ) => {
        switch (status) {
            case "Paid":
                return "bg-green-100 text-green-700";

            case "Failed":
                return "bg-red-100 text-red-700";

            case "Refunded":
                return "bg-purple-100 text-purple-700";

            default:
                return "bg-yellow-100 text-yellow-700";
        }
    };

    /*
     * ============================================================
     * VIEW ORDER DETAILS
     * ============================================================
     *
     * Store the selected order in Zustand before navigating.
     */

    const handleViewDetails = (
        orderId: string
    ) => {
        setSelectedOrderId(
            orderId
        );

        router.push(
            `/dashboard/marketplace/orders/${orderId}`
        );
    };

    /*
     * ============================================================
     * LOADING
     * ============================================================
     */

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">

                <div className="max-w-6xl mx-auto">

                    <div className="bg-white border border-slate-200 p-10 text-center">

                        <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>

                        <p className="text-sm text-slate-500">
                            Loading your orders...
                        </p>

                    </div>

                </div>

            </main>
        );
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
                                "/dashboard/marketplace"
                            )
                        }
                        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition mb-5"
                    >
                        ← Back to Marketplace
                    </button>

                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">

                        <div>

                            <p className="text-sm font-medium text-slate-500 mb-2">
                                HomeMate Marketplace
                            </p>

                            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                                My Orders
                            </h1>

                            <p className="text-sm text-slate-500 mt-2">
                                View and track all your marketplace orders.
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace"
                                )
                            }
                            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 text-sm font-semibold transition"
                        >
                            Continue Shopping
                        </button>

                    </div>

                </div>

                {/* ================= EMPTY STATE ================= */}

                {orders.length === 0 ? (

                    <div className="bg-white border border-slate-200 p-10 md:p-16 text-center">

                        <div className="text-6xl mb-5">
                            📦
                        </div>

                        <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            No Orders Yet
                        </h2>

                        <p className="text-sm text-slate-500 max-w-md mx-auto leading-6 mb-7">
                            You haven't placed any marketplace
                            orders yet. Browse our products and
                            find everything you need for your home.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace"
                                )
                            }
                            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 font-semibold text-sm transition"
                        >
                            Browse Marketplace
                        </button>

                    </div>

                ) : (

                    <div className="space-y-5">

                        {/* ================= ORDER COUNT ================= */}

                        <div className="flex items-center justify-between">

                            <p className="text-sm text-slate-500">

                                Showing{" "}

                                <span className="font-semibold text-slate-800">
                                    {orders.length}
                                </span>{" "}

                                {orders.length === 1
                                    ? "order"
                                    : "orders"}

                            </p>

                        </div>

                        {/* ================= ORDERS ================= */}

                        {orders.map((order) => {

                            const items =
                                orderItems[
                                    order.$id
                                ] || [];

                            return (

                                <div
                                    key={
                                        order.$id
                                    }
                                    className="bg-white border border-slate-200 p-5 md:p-6"
                                >

                                    <div className="flex flex-col gap-6">

                                        {/* ================= TOP ROW ================= */}

                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                                            <div>

                                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                                                    Order ID
                                                </p>

                                                <p className="text-sm font-semibold text-slate-900 break-all">
                                                    {
                                                        order.$id
                                                    }
                                                </p>

                                                <p className="text-xs text-slate-500 mt-2">
                                                    Placed on{" "}
                                                    {formatDate(
                                                        order.$createdAt
                                                    )}
                                                </p>

                                            </div>

                                            <div className="flex flex-wrap gap-2">

                                                <span
                                                    className={`px-3 py-1.5 text-xs font-semibold ${getStatusClass(
                                                        order.status
                                                    )}`}
                                                >
                                                    {
                                                        order.status
                                                    }
                                                </span>

                                                <span
                                                    className={`px-3 py-1.5 text-xs font-semibold ${getPaymentClass(
                                                        order.paymentStatus
                                                    )}`}
                                                >
                                                    Payment:{" "}
                                                    {
                                                        order.paymentStatus
                                                    }
                                                </span>

                                            </div>

                                        </div>

                                        {/* ================= PRODUCTS ================= */}

                                        {items.length > 0 && (

                                            <div className="border-t border-slate-200 pt-5">

                                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">
                                                    Ordered Products
                                                </p>

                                                <div className="space-y-4">

                                                    {items.map(
                                                        (
                                                            item
                                                        ) => (

                                                            <div
                                                                key={
                                                                    item.$id
                                                                }
                                                                className="flex flex-col sm:flex-row gap-4 border border-slate-100 bg-slate-50 p-4"
                                                            >

                                                                {/* PRODUCT IMAGE */}

                                                                <div className="w-full sm:w-24 h-24 flex-shrink-0 bg-white border border-slate-200 overflow-hidden">

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

                                                                                <div className="text-3xl">
                                                                                    📦
                                                                                </div>

                                                                                <p className="text-[10px] text-slate-400 mt-1">
                                                                                    No Image
                                                                                </p>

                                                                            </div>

                                                                        </div>
                                                                    )}

                                                                </div>

                                                                {/* PRODUCT DETAILS */}

                                                                <div className="flex-1 min-w-0">

                                                                    <h3 className="text-base font-bold text-slate-900">
                                                                        {
                                                                            item.productName
                                                                        }
                                                                    </h3>

                                                                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">

                                                                        <p className="text-xs text-slate-500">

                                                                            Price:

                                                                            <span className="ml-1 font-semibold text-slate-700">
                                                                                ₹
                                                                                {item.price.toLocaleString(
                                                                                    "en-IN"
                                                                                )}
                                                                            </span>

                                                                        </p>

                                                                        <p className="text-xs text-slate-500">

                                                                            Quantity:

                                                                            <span className="ml-1 font-semibold text-slate-700">
                                                                                {
                                                                                    item.quantity
                                                                                }
                                                                            </span>

                                                                        </p>

                                                                    </div>

                                                                </div>

                                                                {/* ITEM TOTAL */}

                                                                <div className="sm:text-right sm:min-w-[120px]">

                                                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                                                        Item Total
                                                                    </p>

                                                                    <p className="text-lg font-bold text-slate-900 mt-1">
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

                                                        )
                                                    )}

                                                </div>

                                            </div>

                                        )}

                                        {/* ================= DIVIDER ================= */}

                                        <div className="border-t border-slate-200"></div>

                                        {/* ================= ORDER DETAILS ================= */}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

                                            <div>

                                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                                    Total Amount
                                                </p>

                                                <p className="text-lg font-bold text-slate-900">
                                                    ₹
                                                    {order.totalAmount.toLocaleString(
                                                        "en-IN"
                                                    )}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                                    Order Status
                                                </p>

                                                <p className="text-sm font-semibold text-slate-700">
                                                    {
                                                        order.status
                                                    }
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                                    Payment
                                                </p>

                                                <p className="text-sm font-semibold text-slate-700">
                                                    {
                                                        order.paymentStatus
                                                    }
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                                    Delivery Address
                                                </p>

                                                <p className="text-sm text-slate-600 line-clamp-2">
                                                    {
                                                        order.shippingAddress
                                                    }
                                                </p>

                                            </div>

                                        </div>

                                        {/* ================= BOTTOM ================= */}

                                        <div className="border-t border-slate-200 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                                            <p className="text-xs text-slate-400">

                                                Last updated:{" "}

                                                {formatDate(
                                                    order.$updatedAt
                                                )}

                                            </p>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleViewDetails(
                                                        order.$id
                                                    )
                                                }
                                                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-sm font-semibold transition"
                                            >
                                                View Details →
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            );
                        })}

                    </div>
                )}

            </div>
        </main>
    );
}