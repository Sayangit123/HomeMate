"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import Swal from "sweetalert2";

import {
    getCurrentUser,
} from "@/lib/appwrite/account";

import {
    getCustomerCart,
    updateCartItem,
    deleteCartItem,
} from "@/lib/appwrite/cart";

import {
    getProductById,
} from "@/lib/appwrite/product";

import {
    useCartStore,
} from "@/lib/stores/cart-store";

interface CartDocument {
    $id: string;
    customerId: string;
    productId: string;
    quantity: number;
}

interface Product {
    $id: string;
    productName: string;
    description?: string | null;
    category: string;
    price: number;
    stock: number;
    image?: string | null;
}

interface CartItem {
    cartId: string;
    product: Product;
    quantity: number;
}

export default function CartPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [updatingId, setUpdatingId] =
        useState<string | null>(null);

    const {
        selectedCartItemId,
        setSelectedCartItemId,
        clearSelectedCartItem,
    } = useCartStore();

    /* ============================================================
       TANSTACK QUERY - LOAD CART + PRODUCTS
    ============================================================ */

    const {
        data: cartItems = [],
        isLoading: loading,
    } = useQuery({
        queryKey: ["marketplace-cart"],

        queryFn: async (): Promise<CartItem[]> => {
            try {
                const user =
                    await getCurrentUser();

                const response =
                    await getCustomerCart(
                        user.$id
                    );

                const cartDocuments =
                    response.documents as unknown as CartDocument[];

                const items: CartItem[] = [];

                for (
                    const cartItem of cartDocuments
                ) {
                    try {
                        const productResponse =
                            await getProductById(
                                cartItem.productId
                            );

                        items.push({
                            cartId:
                                cartItem.$id,

                            product:
                                productResponse as unknown as Product,

                            quantity:
                                Number(
                                    cartItem.quantity
                                ) || 1,
                        });
                    } catch (error) {
                        console.error(
                            "Product load error:",
                            error
                        );
                    }
                }

                return items;
            } catch (error) {
                console.error(
                    "Load cart error:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Unable to Load Cart",
                    text:
                        "Something went wrong while loading your cart.",
                    confirmButtonColor:
                        "#0f172a",
                });

                throw error;
            }
        },
    });

    /* ============================================================
       TANSTACK QUERY - UPDATE QUANTITY
    ============================================================ */

    const updateQuantityMutation =
        useMutation({
            mutationFn: async ({
                item,
                quantity,
            }: {
                item: CartItem;
                quantity: number;
            }) => {
                setUpdatingId(item.cartId);

                setSelectedCartItemId(
                    item.cartId
                );

                await updateCartItem(
                    item.cartId,
                    {
                        quantity,
                    }
                );
            },

            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: [
                        "marketplace-cart",
                    ],
                });
            },

            onError: async (error) => {
                console.error(
                    "Update quantity error:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Update Failed",
                    text:
                        "Unable to update the quantity.",
                    confirmButtonColor:
                        "#0f172a",
                });
            },

            onSettled: () => {
                setUpdatingId(null);

                clearSelectedCartItem();
            },
        });

    /* ============================================================
       TANSTACK QUERY - REMOVE CART ITEM
    ============================================================ */

    const removeItemMutation =
        useMutation({
            mutationFn: async (
                item: CartItem
            ) => {
                setUpdatingId(item.cartId);

                setSelectedCartItemId(
                    item.cartId
                );

                await deleteCartItem(
                    item.cartId
                );
            },

            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: [
                        "marketplace-cart",
                    ],
                });

                await Swal.fire({
                    icon: "success",
                    title: "Removed",
                    text:
                        "Product has been removed from your cart.",
                    confirmButtonColor:
                        "#0f172a",
                });
            },

            onError: async (error) => {
                console.error(
                    "Remove cart item error:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Remove Failed",
                    text:
                        "Unable to remove this product from your cart.",
                    confirmButtonColor:
                        "#0f172a",
                });
            },

            onSettled: () => {
                setUpdatingId(null);

                clearSelectedCartItem();
            },
        });

    /* ============================================================
       INCREASE QUANTITY
    ============================================================ */

    const increaseQuantity = async (
        item: CartItem
    ) => {
        if (
            item.quantity >=
            item.product.stock
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Maximum Stock Reached",
                text:
                    "You cannot add more than the available stock.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }

        updateQuantityMutation.mutate({
            item,
            quantity:
                item.quantity + 1,
        });
    };

    /* ============================================================
       DECREASE QUANTITY
    ============================================================ */

    const decreaseQuantity = async (
        item: CartItem
    ) => {
        if (item.quantity <= 1) {
            return;
        }

        updateQuantityMutation.mutate({
            item,
            quantity:
                item.quantity - 1,
        });
    };

    /* ============================================================
       REMOVE ITEM
    ============================================================ */

    const removeItem = async (
        item: CartItem
    ) => {
        const result =
            await Swal.fire({
                icon: "warning",
                title: "Remove Product?",
                text: `${item.product.productName} will be removed from your cart.`,
                showCancelButton: true,
                confirmButtonText:
                    "Yes, Remove",
                cancelButtonText:
                    "Keep It",
                confirmButtonColor:
                    "#0f172a",
                cancelButtonColor:
                    "#94a3b8",
            });

        if (!result.isConfirmed) {
            return;
        }

        removeItemMutation.mutate(item);
    };

    /* ============================================================
       CART TOTALS
    ============================================================ */

    const totalItems = cartItems.reduce(
        (total, item) =>
            total + item.quantity,
        0
    );

    const cartTotal = cartItems.reduce(
        (total, item) =>
            total +
            item.product.price *
                item.quantity,
        0
    );

    /* ============================================================
       LOADING
    ============================================================ */

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9] px-4">
                <div className="text-center">

                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />

                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                        Loading Cart
                    </p>

                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f5f7f9]">

            {/* ================= HEADER ================= */}

            <header className="border-b border-slate-200 bg-white">

                <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-10">

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/marketplace"
                            )
                        }
                        className="text-sm font-medium text-slate-400 transition hover:text-slate-950"
                    >
                        ← Continue Shopping
                    </button>

                    <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

                        <div>

                            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                HomeMate Marketplace
                            </p>

                            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                                My Cart
                            </h1>

                            <p className="mt-2 text-sm text-slate-500">
                                Review your selected
                                products before checkout.
                            </p>

                        </div>

                        {cartItems.length > 0 && (
                            <div className="border border-slate-200 bg-slate-50 px-5 py-3">

                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Cart Items
                                </p>

                                <p className="mt-1 text-lg font-bold text-slate-950">
                                    {totalItems}
                                </p>

                            </div>
                        )}

                    </div>

                </div>

            </header>

            {/* ================= CONTENT ================= */}

            <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">

                {cartItems.length === 0 ? (

                    /* ================= EMPTY CART ================= */

                    <div className="border border-slate-200 bg-white px-6 py-16 text-center sm:px-10">

                        <div className="mx-auto flex h-20 w-20 items-center justify-center border border-slate-200 bg-slate-50 text-4xl">
                            🛒
                        </div>

                        <h2 className="mt-7 text-2xl font-bold text-slate-950">
                            Your Cart Is Empty
                        </h2>

                        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                            You haven't added any
                            products to your cart yet.
                            Explore the HomeMate
                            Marketplace and find
                            something useful for your
                            home.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace"
                                )
                            }
                            className="mt-8 border border-slate-950 bg-slate-950 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                            Browse Marketplace →
                        </button>

                    </div>

                ) : (

                    /* ================= CART ================= */

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">

                        {/* ================= ITEMS ================= */}

                        <div className="space-y-4">

                            {cartItems.map(
                                (item) => {

                                    const subtotal =
                                        item.product
                                            .price *
                                        item.quantity;

                                    const isUpdating =
                                        updatingId ===
                                            item.cartId ||
                                        selectedCartItemId ===
                                            item.cartId;

                                    return (
                                        <div
                                            key={
                                                item.cartId
                                            }
                                            className="border border-slate-200 bg-white p-5 sm:p-6"
                                        >

                                            <div className="flex flex-col gap-6 sm:flex-row">

                                                {/* IMAGE */}

                                                <div className="h-48 w-full shrink-0 bg-slate-100 sm:h-40 sm:w-40">

                                                    {item
                                                        .product
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
                                                            className="h-full w-full object-cover"
                                                        />

                                                    ) : (

                                                        <div className="flex h-full w-full items-center justify-center text-5xl">
                                                            📦
                                                        </div>

                                                    )}

                                                </div>

                                                {/* DETAILS */}

                                                <div className="flex min-w-0 flex-1 flex-col">

                                                    <div className="flex flex-col justify-between gap-3 sm:flex-row">

                                                        <div>

                                                            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                                                {
                                                                    item
                                                                        .product
                                                                        .category
                                                                }
                                                            </p>

                                                            <h2 className="mt-2 text-xl font-bold text-slate-950">
                                                                {
                                                                    item
                                                                        .product
                                                                        .productName
                                                                }
                                                            </h2>

                                                        </div>

                                                        <button
                                                            type="button"
                                                            disabled={
                                                                isUpdating
                                                            }
                                                            onClick={() =>
                                                                removeItem(
                                                                    item
                                                                )
                                                            }
                                                            className="self-start text-xs font-bold text-red-500 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Remove
                                                        </button>

                                                    </div>

                                                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                                                        {item
                                                            .product
                                                            .description ||
                                                            "No description available."}
                                                    </p>

                                                    <div className="mt-auto flex flex-col gap-5 pt-6 sm:flex-row sm:items-end sm:justify-between">

                                                        {/* PRICE */}

                                                        <div>

                                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                                                Unit Price
                                                            </p>

                                                            <p className="mt-1 text-lg font-bold text-slate-950">
                                                                ₹
                                                                {item
                                                                    .product
                                                                    .price.toLocaleString(
                                                                        "en-IN"
                                                                    )}
                                                            </p>

                                                        </div>

                                                        {/* QUANTITY */}

                                                        <div>

                                                            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                                                Quantity
                                                            </p>

                                                            <div className="flex items-center border border-slate-200">

                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        item.quantity <=
                                                                            1 ||
                                                                        isUpdating
                                                                    }
                                                                    onClick={() =>
                                                                        decreaseQuantity(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-600 transition hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white disabled:hover:text-slate-300"
                                                                >
                                                                    −
                                                                </button>

                                                                <div className="flex h-10 min-w-12 items-center justify-center border-x border-slate-200 px-3 text-sm font-bold text-slate-950">
                                                                    {
                                                                        item.quantity
                                                                    }
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        isUpdating ||
                                                                        item.quantity >=
                                                                            item
                                                                                .product
                                                                                .stock
                                                                    }
                                                                    onClick={() =>
                                                                        increaseQuantity(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-600 transition hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white disabled:hover:text-slate-300"
                                                                >
                                                                    +
                                                                </button>

                                                            </div>

                                                            <p className="mt-2 text-[10px] text-slate-400">
                                                                Stock:{" "}
                                                                {
                                                                    item
                                                                        .product
                                                                        .stock
                                                                }
                                                            </p>

                                                        </div>

                                                        {/* SUBTOTAL */}

                                                        <div className="sm:text-right">

                                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                                                Subtotal
                                                            </p>

                                                            <p className="mt-1 text-xl font-bold text-slate-950">
                                                                ₹
                                                                {subtotal.toLocaleString(
                                                                    "en-IN"
                                                                )}
                                                            </p>

                                                        </div>

                                                    </div>

                                                </div>

                                            </div>

                                        </div>
                                    );
                                }
                            )}

                        </div>

                        {/* ================= SUMMARY ================= */}

                        <aside className="h-fit border border-slate-200 bg-white">

                            <div className="border-b border-slate-200 px-6 py-6">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Order Summary
                                </p>

                                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                                    Cart Total
                                </h2>

                            </div>

                            <div className="space-y-5 px-6 py-6">

                                <div className="flex items-center justify-between text-sm">

                                    <span className="text-slate-500">
                                        Products
                                    </span>

                                    <span className="font-semibold text-slate-950">
                                        {totalItems}
                                    </span>

                                </div>

                                <div className="flex items-center justify-between text-sm">

                                    <span className="text-slate-500">
                                        Subtotal
                                    </span>

                                    <span className="font-semibold text-slate-950">
                                        ₹
                                        {cartTotal.toLocaleString(
                                            "en-IN"
                                        )}
                                    </span>

                                </div>

                                <div className="flex items-center justify-between text-sm">

                                    <span className="text-slate-500">
                                        Delivery
                                    </span>

                                    <span className="font-semibold text-emerald-700">
                                        Calculated at
                                        checkout
                                    </span>

                                </div>

                                <div className="border-t border-slate-200 pt-5">

                                    <div className="flex items-end justify-between gap-4">

                                        <span className="text-sm font-bold text-slate-950">
                                            Total
                                        </span>

                                        <span className="text-2xl font-bold text-slate-950">
                                            ₹
                                            {cartTotal.toLocaleString(
                                                "en-IN"
                                            )}
                                        </span>

                                    </div>

                                </div>

                                {/* ================= CHECKOUT ================= */}

                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/dashboard/marketplace/checkout"
                                        )
                                    }
                                    className="w-full border border-slate-950 bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
                                >
                                    Proceed to Checkout →
                                </button>

                                {/* ================= CONTINUE SHOPPING ================= */}

                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/dashboard/marketplace"
                                        )
                                    }
                                    className="w-full border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                                >
                                    Continue Shopping
                                </button>

                            </div>

                        </aside>

                    </div>
                )}

            </div>

        </main>
    );
}