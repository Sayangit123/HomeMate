"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import Swal from "sweetalert2";

import { getCurrentUser } from "@/lib/appwrite/account";

import {
    getCustomerCart,
    deleteCartItem,
} from "@/lib/appwrite/cart";

import { getProductById } from "@/lib/appwrite/product";

import { createOrder } from "@/lib/appwrite/order";
import { createOrderItem } from "@/lib/appwrite/orderItem";
import { createPayment } from "@/lib/appwrite/payments";

import {
    useCheckoutStore,
} from "@/lib/stores/checkout-store";

interface Product {
    $id: string;
    productName: string;
    description?: string | null;
    category: string;
    price: number;
    stock: number;
    image?: string | null;
}

interface CartDocument {
    $id: string;
    customerId: string;
    productId: string;
    quantity: number;
}

interface CheckoutItem {
    cartId: string;
    product: Product;
    quantity: number;
}

export default function CheckoutPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    /*
     * ============================================================
     * ZUSTAND CHECKOUT STATE
     * ============================================================
     */

    const {
        shippingAddress,
        paymentMethod,
        setShippingAddress,
        setPaymentMethod,
        resetCheckout,
    } = useCheckoutStore();

    /*
     * ============================================================
     * LOCAL UI STATE
     * ============================================================
     *
     * This state is only for UI-specific information.
     * Server data is handled by TanStack Query.
     */

    const [processingCartId, setProcessingCartId] =
        useState<string | null>(null);

    /*
     * ============================================================
     * TANSTACK QUERY - LOAD CHECKOUT CART
     * ============================================================
     */

    const {
        data: items = [],
        isLoading: loading,
    } = useQuery({
        queryKey: ["marketplace-checkout-cart"],

        queryFn: async (): Promise<CheckoutItem[]> => {
            try {
                const user =
                    await getCurrentUser();

                const cartResponse =
                    await getCustomerCart(
                        user.$id
                    );

                const cartDocuments =
                    cartResponse.documents as unknown as CartDocument[];

                if (cartDocuments.length === 0) {
                    return [];
                }

                const checkoutItems: CheckoutItem[] =
                    [];

                for (
                    const cartItem of cartDocuments
                ) {
                    try {
                        const product =
                            await getProductById(
                                cartItem.productId
                            );

                        checkoutItems.push({
                            cartId:
                                cartItem.$id,

                            product:
                                product as unknown as Product,

                            quantity:
                                Number(
                                    cartItem.quantity
                                ) || 1,
                        });
                    } catch (error) {
                        console.error(
                            "Failed to load product:",
                            error
                        );
                    }
                }

                return checkoutItems;
            } catch (error) {
                console.error(
                    "Checkout loading error:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title:
                        "Unable to Load Checkout",
                    text:
                        "Something went wrong while loading your cart.",
                    confirmButtonColor:
                        "#0f172a",
                });

                throw error;
            }
        },
    });

    /*
     * ============================================================
     * ORDER TOTALS
     * ============================================================
     */

    const subtotal = items.reduce(
        (total, item) =>
            total +
            item.product.price *
                item.quantity,
        0
    );

    const totalItems = items.reduce(
        (total, item) =>
            total + item.quantity,
        0
    );

    /*
     * ============================================================
     * CREATE APPWRITE ORDER AFTER PAYMENT
     * ============================================================
     */

    const createAppwriteOrder = async (
        userId: string,
        paid: boolean,
        transactionId?: string
    ) => {
        const order = await createOrder({
            customerId: userId,
            totalAmount: subtotal,
            status: "Pending",
            shippingAddress: shippingAddress.trim(),
            paymentStatus: paid ? "Paid" : "Pending",
        });

        /*
         * ---------------- CREATE PAYMENT RECORD ----------------
         */

        await createPayment({
            customerId: userId,
            orderId: order.$id,
            amount: subtotal,
            paymentMethod: paid ? "Online Payment" : "Cash",
            transcationId: transactionId || `COD-${Date.now()}`,
            status: paid ? "Completed" : "Pending",
            paymentDate: new Date().toISOString(),
        });

        /*
         * ---------------- ORDER NOTIFICATION ----------------
         */

        try {
            const notificationResponse = await fetch(
                "/api/notifications/orders",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        customerId: userId,
                        orderId: order.$id,
                        status: "Pending",
                    }),
                }
            );

            if (!notificationResponse.ok) {
                console.error(
                    "Order was created, but order notification could not be created."
                );
            }
        } catch (notificationError) {
            console.error(
                "Order notification request failed:",
                notificationError
            );
        }

        /*
         * ---------------- CREATE ORDER ITEMS ----------------
         */

        for (const item of items) {
            await createOrderItem({
                orderId: order.$id,
                productId: item.product.$id,
                productName: item.product.productName,
                productImage: item.product.image ?? null,
                price: item.product.price,
                quantity: item.quantity,
            });
        }

        /*
         * ---------------- CLEAR CART ----------------
         */

        for (const item of items) {
            setProcessingCartId(item.cartId);
            await deleteCartItem(item.cartId);
        }

        return order;
    };

    /*
     * ============================================================
     * TANSTACK QUERY MUTATION - PLACE ORDER / RAZORPAY
     * ============================================================
     */

    const placeOrderMutation = useMutation({
        mutationFn: async () => {
            /*
             * ---------------- VALIDATE USER ----------------
             */

            const user = await getCurrentUser();

            /*
             * ---------------- VALIDATE ADDRESS ----------------
             */

            if (shippingAddress.trim() === "") {
                throw new Error("SHIPPING_ADDRESS_REQUIRED");
            }

            /*
             * ---------------- VALIDATE CART ----------------
             */

            if (items.length === 0) {
                throw new Error("CART_EMPTY");
            }

            /*
             * ---------------- STOCK VALIDATION ----------------
             */

            const unavailableItem = items.find(
                (item) => item.quantity > item.product.stock
            );

            if (unavailableItem) {
                throw new Error(
                    `INSUFFICIENT_STOCK:${unavailableItem.product.productName}`
                );
            }

            /*
             * ---------------- CONFIRM ORDER ----------------
             */

            const confirmation = await Swal.fire({
                icon: "question",
                title: "Place Order?",
                html: `
                    <div style="text-align:left">
                        <p style="margin-bottom:8px">
                            <strong>Total Items:</strong>
                            ${totalItems}
                        </p>
                        <p style="margin-bottom:8px">
                            <strong>Total Amount:</strong>
                            ₹${subtotal.toLocaleString("en-IN")}
                        </p>
                        <p>
                            <strong>Payment:</strong>
                            ${paymentMethod}
                        </p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText:
                    paymentMethod === "Online Payment"
                        ? "Proceed to Payment"
                        : "Place Order",
                cancelButtonText: "Cancel",
                confirmButtonColor: "#0f172a",
            });

            if (!confirmation.isConfirmed) {
                throw new Error("ORDER_CANCELLED");
            }

            /*
             * =====================================================
             * ONLINE PAYMENT - RAZORPAY
             * =====================================================
             */

            if (paymentMethod === "Online Payment") {
                if (!window.Razorpay) {
                    throw new Error("RAZORPAY_NOT_LOADED");
                }

                /*
                 * Create Razorpay order on our server.
                 * The amount is sent in rupees here and converted
                 * to paise inside /api/payments/create-order.
                 */

                const razorpayOrderResponse = await fetch(
                    "/api/payments/create-order",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            amount: subtotal,
                        }),
                    }
                );

                const razorpayOrderData =
                    await razorpayOrderResponse.json();

                if (
                    !razorpayOrderResponse.ok ||
                    !razorpayOrderData.success ||
                    !razorpayOrderData.order?.id
                ) {
                    console.error(
                        "Razorpay order creation failed:",
                        razorpayOrderData
                    );

                    throw new Error("RAZORPAY_ORDER_FAILED");
                }

                const razorpayOrder =
                    razorpayOrderData.order;

                /*
                 * Open Razorpay Checkout and wait until the
                 * payment is verified by our server.
                 */

                const paidOrder = await new Promise<
                    Awaited<ReturnType<typeof createOrder>>
                >((resolve, reject) => {
                    const razorpay = new window.Razorpay({
                        key:
                            process.env
                                .NEXT_PUBLIC_RAZORPAY_KEY_ID!,
                        amount: razorpayOrder.amount,
                        currency:
                            razorpayOrder.currency || "INR",
                        name: "HomeMate",
                        description:
                            "HomeMate Marketplace Order",
                        order_id: razorpayOrder.id,
                        prefill: {
                            email: user.email,
                        },
                        notes: {
                            customerId: user.$id,
                        },
                        theme: {
                            color: "#0f172a",
                        },
                        handler: async (
                            response
                        ) => {
                            try {
                                /*
                                 * Verify Razorpay signature on
                                 * our server before creating the
                                 * real Appwrite order.
                                 */

                                const verifyResponse =
                                    await fetch(
                                        "/api/payments/verify",
                                        {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify(
                                                {
                                                    razorpay_order_id:
                                                        response.razorpay_order_id,
                                                    razorpay_payment_id:
                                                        response.razorpay_payment_id,
                                                    razorpay_signature:
                                                        response.razorpay_signature,
                                                }
                                            ),
                                        }
                                    );

                                const verifyData =
                                    await verifyResponse.json();

                                if (
                                    !verifyResponse.ok ||
                                    !verifyData.success
                                ) {
                                    console.error(
                                        "Razorpay verification failed:",
                                        verifyData
                                    );

                                    reject(
                                        new Error(
                                            "RAZORPAY_VERIFICATION_FAILED"
                                        )
                                    );
                                    return;
                                }

                                /*
                                 * Payment is verified.
                                 * Now create the Appwrite order,
                                 * order items and clear the cart.
                                 */

                                const order =
                                    await createAppwriteOrder(
                                        user.$id,
                                        true,
                                        response.razorpay_payment_id
                                    );

                                resolve(order);
                            } catch (error) {
                                console.error(
                                    "Razorpay payment handler error:",
                                    error
                                );

                                reject(error);
                            }
                        },
                        modal: {
                            ondismiss: () => {
                                reject(
                                    new Error(
                                        "RAZORPAY_CANCELLED"
                                    )
                                );
                            },
                        },
                    });

                    razorpay.open();
                });

                return paidOrder;
            }

            /*
             * =====================================================
             * CASH ON DELIVERY
             * =====================================================
             */

            return await createAppwriteOrder(
                user.$id,
                false,
                `COD-${Date.now()}`
            );
        },

        onSuccess: async (order) => {
            await queryClient.invalidateQueries({
                queryKey: [
                    "marketplace-checkout-cart",
                ],
            });

            await queryClient.invalidateQueries({
                queryKey: ["marketplace-cart"],
            });

            resetCheckout();

            await Swal.fire({
                icon: "success",
                title: "Order Placed Successfully",
                text:
                    paymentMethod === "Online Payment"
                        ? "Your payment was verified and your order has been placed successfully."
                        : "Your order has been placed successfully.",
                confirmButtonColor: "#0f172a",
            });

            router.push(
                `/dashboard/marketplace/orders/${order.$id}`
            );
        },

        onError: async (error) => {
            const message =
                error instanceof Error
                    ? error.message
                    : "";

            if (message === "ORDER_CANCELLED") {
                return;
            }

            if (message === "RAZORPAY_CANCELLED") {
                await Swal.fire({
                    icon: "info",
                    title: "Payment Cancelled",
                    text:
                        "Your payment was cancelled. No order was created and your cart is unchanged.",
                    confirmButtonColor: "#0f172a",
                });
                return;
            }

            if (message === "RAZORPAY_NOT_LOADED") {
                await Swal.fire({
                    icon: "error",
                    title: "Payment Gateway Not Ready",
                    text:
                        "Razorpay could not be loaded. Please refresh the page and try again.",
                    confirmButtonColor: "#0f172a",
                });
                return;
            }

            if (message === "RAZORPAY_ORDER_FAILED") {
                await Swal.fire({
                    icon: "error",
                    title: "Unable to Start Payment",
                    text:
                        "We could not create the Razorpay payment order. Please try again.",
                    confirmButtonColor: "#0f172a",
                });
                return;
            }

            if (
                message ===
                "RAZORPAY_VERIFICATION_FAILED"
            ) {
                await Swal.fire({
                    icon: "error",
                    title: "Payment Verification Failed",
                    text:
                        "Your payment could not be verified. Your cart has not been cleared.",
                    confirmButtonColor: "#0f172a",
                });
                return;
            }

            if (
                message ===
                "SHIPPING_ADDRESS_REQUIRED"
            ) {
                await Swal.fire({
                    icon: "warning",
                    title: "Shipping Address Required",
                    text:
                        "Please enter your delivery address.",
                    confirmButtonColor: "#0f172a",
                });
                return;
            }

            if (message === "CART_EMPTY") {
                await Swal.fire({
                    icon: "warning",
                    title: "Cart Is Empty",
                    text:
                        "Please add a product to your cart before checkout.",
                    confirmButtonColor: "#0f172a",
                });
                return;
            }

            if (
                message.startsWith(
                    "INSUFFICIENT_STOCK:"
                )
            ) {
                const productName = message.replace(
                    "INSUFFICIENT_STOCK:",
                    ""
                );

                await Swal.fire({
                    icon: "error",
                    title: "Insufficient Stock",
                    text: `${productName} does not have enough stock for your requested quantity.`,
                    confirmButtonColor: "#0f172a",
                });
                return;
            }

            console.error(
                "Place order error:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Order Failed",
                text:
                    "Something went wrong while placing your order. Please try again.",
                confirmButtonColor: "#0f172a",
            });
        },

        onSettled: () => {
            setProcessingCartId(null);
        },
    });

    /*
     * ============================================================
     * PLACE ORDER HANDLER
     * ============================================================
     */

    const placeOrder = () => {
        placeOrderMutation.mutate();
    };

    /*
     * ============================================================
     * LOADING
     * ============================================================
     */

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">

                <div className="text-center">

                    <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>

                    <p className="text-sm text-slate-500">
                        Loading checkout...
                    </p>

                </div>

            </main>
        );
    }

    /*
     * ============================================================
     * EMPTY CART
     * ============================================================
     */

    if (items.length === 0) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">

                <div className="max-w-5xl mx-auto">

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/marketplace"
                            )
                        }
                        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition mb-6"
                    >
                        ← Back to Marketplace
                    </button>

                    <div className="bg-white border border-slate-200 px-6 py-16 text-center">

                        <div className="text-6xl mb-5">
                            🛒
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900">
                            Your Cart Is Empty
                        </h1>

                        <p className="text-sm text-slate-500 mt-2 mb-7">
                            Add products to your cart
                            before proceeding to
                            checkout.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace"
                                )
                            }
                            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 text-sm font-semibold transition"
                        >
                            Browse Marketplace
                        </button>

                    </div>

                </div>

            </main>
        );
    }

    /*
     * ============================================================
     * CHECKOUT PAGE
     * ============================================================
     */

    return (
        <>
            <Script
                src="https://checkout.razorpay.com/v1/checkout.js"
                strategy="afterInteractive"
            />

            <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">

            <div className="max-w-6xl mx-auto">

                {/* ================= HEADER ================= */}

                <div className="mb-8">

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/marketplace/cart"
                            )
                        }
                        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition mb-5"
                    >
                        ← Back to Cart
                    </button>

                    <p className="text-sm font-medium text-slate-500 mb-2">
                        HomeMate Marketplace
                    </p>

                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                        Checkout
                    </h1>

                    <p className="text-sm text-slate-500 mt-2">
                        Review your order and enter
                        your delivery address.
                    </p>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ================= LEFT ================= */}

                    <div className="lg:col-span-2 space-y-6">

                        {/* ================= SHIPPING ADDRESS ================= */}

                        <section className="bg-white border border-slate-200 p-6">

                            <div className="flex items-center gap-3 mb-5">

                                <div className="w-10 h-10 bg-slate-100 flex items-center justify-center">
                                    📍
                                </div>

                                <div>

                                    <h2 className="text-xl font-bold text-slate-900">
                                        Delivery Address
                                    </h2>

                                    <p className="text-sm text-slate-500 mt-1">
                                        Where should we
                                        deliver your order?
                                    </p>

                                </div>

                            </div>

                            <textarea
                                value={
                                    shippingAddress
                                }
                                onChange={(
                                    event
                                ) =>
                                    setShippingAddress(
                                        event.target.value
                                    )
                                }
                                rows={5}
                                placeholder="Enter your complete delivery address..."
                                className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none resize-none transition focus:border-slate-900 focus:bg-white"
                            />

                        </section>

                        {/* ================= ORDER ITEMS ================= */}

                        <section className="bg-white border border-slate-200 p-6">

                            <div className="flex items-center justify-between mb-6">

                                <div>

                                    <h2 className="text-xl font-bold text-slate-900">
                                        Review Your Order
                                    </h2>

                                    <p className="text-sm text-slate-500 mt-1">
                                        {totalItems}{" "}
                                        {totalItems ===
                                        1
                                            ? "item"
                                            : "items"}
                                    </p>

                                </div>

                            </div>

                            <div className="space-y-5">

                                {items.map(
                                    (item) => (
                                        <div
                                            key={
                                                item.cartId
                                            }
                                            className="flex flex-col sm:flex-row gap-4 border-b border-slate-100 pb-5 last:border-b-0 last:pb-0"
                                        >

                                            {/* IMAGE */}

                                            <div className="w-full sm:w-28 h-28 bg-slate-100 flex-shrink-0 overflow-hidden">

                                                {item.product
                                                    .image ? (

                                                    <img
                                                        src={
                                                            item
                                                                .product
                                                                .image
                                                        }
                                                        alt={
                                                            item
                                                                .product
                                                                .productName
                                                        }
                                                        className="w-full h-full object-cover"
                                                    />

                                                ) : (

                                                    <div className="w-full h-full flex items-center justify-center text-4xl">
                                                        📦
                                                    </div>

                                                )}

                                            </div>

                                            {/* DETAILS */}

                                            <div className="flex-1">

                                                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                                                    {
                                                        item
                                                            .product
                                                            .category
                                                    }
                                                </p>

                                                <h3 className="text-lg font-bold text-slate-900 mt-1">
                                                    {
                                                        item
                                                            .product
                                                            .productName
                                                    }
                                                </h3>

                                                <div className="flex flex-wrap items-center gap-4 mt-3">

                                                    <p className="text-sm text-slate-500">
                                                        Quantity:{" "}
                                                        <span className="font-semibold text-slate-800">
                                                            {
                                                                item.quantity
                                                            }
                                                        </span>
                                                    </p>

                                                    <p className="text-sm text-slate-500">
                                                        Price:{" "}
                                                        <span className="font-semibold text-slate-800">
                                                            ₹
                                                            {item.product.price.toLocaleString(
                                                                "en-IN"
                                                            )}
                                                        </span>
                                                    </p>

                                                </div>

                                            </div>

                                            {/* ITEM TOTAL */}

                                            <div className="sm:text-right">

                                                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                                                    Total
                                                </p>

                                                <p className="text-xl font-bold text-slate-900 mt-1">
                                                    ₹
                                                    {(
                                                        item
                                                            .product
                                                            .price *
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

                        </section>

                    </div>

                    {/* ================= RIGHT ================= */}

                    <div className="space-y-6">

                        {/* ================= SUMMARY ================= */}

                        <section className="bg-white border border-slate-200 p-6">

                            <h2 className="text-xl font-bold text-slate-900 mb-6">
                                Order Summary
                            </h2>

                            <div className="space-y-4">

                                <div className="flex justify-between gap-4">

                                    <span className="text-sm text-slate-500">
                                        Items
                                    </span>

                                    <span className="text-sm font-semibold text-slate-900">
                                        {totalItems}
                                    </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                    <span className="text-sm text-slate-500">
                                        Subtotal
                                    </span>

                                    <span className="text-sm font-semibold text-slate-900">
                                        ₹
                                        {subtotal.toLocaleString(
                                            "en-IN"
                                        )}
                                    </span>

                                </div>

                                <div className="flex justify-between gap-4">

                                    <span className="text-sm text-slate-500">
                                        Delivery
                                    </span>

                                    <span className="text-sm font-semibold text-green-600">
                                        Free
                                    </span>

                                </div>

                                <div className="border-t border-slate-200 pt-4 flex justify-between gap-4">

                                    <span className="font-bold text-slate-900">
                                        Total
                                    </span>

                                    <span className="text-2xl font-bold text-slate-900">
                                        ₹
                                        {subtotal.toLocaleString(
                                            "en-IN"
                                        )}
                                    </span>

                                </div>

                            </div>

                        </section>

                        {/* ================= PAYMENT ================= */}

                        <section className="bg-white border border-slate-200 p-6">

                            <h2 className="text-lg font-bold text-slate-900 mb-4">
                                Payment
                            </h2>

                            <div className="border border-yellow-200 bg-yellow-50 p-4">

                                <div className="flex items-start gap-3">

                                    <span className="text-lg">
                                        💳
                                    </span>

                                    <div>

                                        <p className="text-sm font-semibold text-yellow-800">
                                            Payment Pending
                                        </p>

                                        <p className="text-xs text-yellow-700 mt-1 leading-5">
                                            Online payments are
                                            securely processed
                                            through Razorpay in
                                            Test Mode. Your order
                                            is created only after
                                            successful payment
                                            verification.
                                        </p>

                                    </div>

                                </div>

                            </div>

                            {/* PAYMENT METHOD */}

                            <div className="mt-4">

                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                    Payment Method
                                </label>

                                <select
                                    value={
                                        paymentMethod
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setPaymentMethod(
                                            event.target.value
                                        )
                                    }
                                    className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                                >
                                    <option value="Online Payment">
                                        Online Payment
                                    </option>

                                    <option value="Cash on Delivery">
                                        Cash on Delivery
                                    </option>
                                </select>

                            </div>

                        </section>

                        {/* ================= PLACE ORDER ================= */}

                        <button
                            type="button"
                            disabled={
                                placeOrderMutation.isPending ||
                                processingCartId !==
                                    null
                            }
                            onClick={
                                placeOrder
                            }
                            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-4 text-sm font-bold transition"
                        >
                            {placeOrderMutation.isPending
                                ? "Placing Order..."
                                : "Place Order"}
                        </button>

                        <p className="text-xs text-center text-slate-400 leading-5">
                            By placing this order,
                            you confirm that the
                            delivery information
                            provided is correct.
                        </p>

                    </div>

                </div>

            </div>

            </main>
        </>
    );
}