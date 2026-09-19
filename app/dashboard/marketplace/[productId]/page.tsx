"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

import {
    getProductById,
} from "@/lib/appwrite/product";

import {
    getCartItemByProduct,
    createCartItem,
    updateCartItem,
} from "@/lib/appwrite/cart";

import {
    getCurrentUser,
} from "@/lib/appwrite/account";

import {
    createReview,
    getProductReviews,
    getCustomerProductReview,
    updateReview,
    deleteReview,
} from "@/lib/appwrite/review";

interface Product {
    $id: string;
    businessId: string;
    productName: string;
    description?: string | null;
    category: string;
    price: number;
    stock: number;
    image?: string | null;
    $createdAt?: string;
}

interface Review {
    $id: string;
    productId: string;
    customerId: string;
    rating: number;
    review?: string | null;
    $createdAt?: string;
}

export default function ProductDetailsPage() {
    const router = useRouter();

    const [product, setProduct] =
        useState<Product | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(false);

    /* ================= REVIEW STATES ================= */

    const [reviews, setReviews] =
        useState<Review[]>([]);

    const [myReview, setMyReview] =
        useState<Review | null>(null);

    const [selectedRating, setSelectedRating] =
        useState(0);

    const [reviewText, setReviewText] =
        useState("");

    const [reviewLoading, setReviewLoading] =
        useState(false);

    const [reviewsLoading, setReviewsLoading] =
        useState(true);

    const [editingReview, setEditingReview] =
        useState(false);

    /* ================= PRODUCT ID ================= */

    const getProductId = () => {
        if (typeof window === "undefined") {
            return "";
        }

        const match =
            window.location.pathname.match(
                /\/marketplace\/([^/]+)$/
            );

        return match?.[1] || "";
    };

    /* ================= ADD TO CART ================= */

    const addToCart = async () => {
        if (!product) {
            return;
        }

        try {
            const user =
                await getCurrentUser();

            const existingItem =
                await getCartItemByProduct(
                    user.$id,
                    product.$id
                );

            if (existingItem) {
                const currentQuantity =
                    Number(
                        existingItem.quantity
                    ) || 0;

                if (
                    currentQuantity >=
                    product.stock
                ) {
                    await Swal.fire({
                        icon: "warning",
                        title: "Maximum Stock Reached",
                        text: `You already have the maximum available quantity of ${product.productName} in your cart.`,
                        confirmButtonColor:
                            "#0f172a",
                    });

                    return;
                }

                await updateCartItem(
                    existingItem.$id,
                    {
                        quantity:
                            currentQuantity + 1,
                    }
                );
            } else {
                await createCartItem({
                    customerId: user.$id,
                    productId: product.$id,
                    quantity: 1,
                });
            }

            await Swal.fire({
                icon: "success",
                title: "Added to Cart",
                text: `${product.productName} has been added to your cart.`,
                confirmButtonColor:
                    "#0f172a",
            });
        } catch (error) {
            console.error(
                "Add to cart error:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Unable to Add",
                text: "Something went wrong while adding this product to your cart.",
                confirmButtonColor:
                    "#0f172a",
            });
        }
    };

    /* ================= LOAD PRODUCT ================= */

    const loadProduct = async () => {
        try {
            setLoading(true);
            setError(false);

            const productId =
                getProductId();

            if (!productId) {
                throw new Error(
                    "Product ID not found"
                );
            }

            const response =
                await getProductById(
                    productId
                );

            setProduct(
                response as unknown as Product
            );
        } catch (error) {
            console.error(
                "Load product details error:",
                error
            );

            setError(true);

            await Swal.fire({
                icon: "error",
                title: "Product Not Found",
                text:
                    "The product could not be found or may have been removed.",
                confirmButtonColor:
                    "#0f172a",
            });
        } finally {
            setLoading(false);
        }
    };

    /* ================= LOAD REVIEWS ================= */

    const loadReviews = async (
        productId: string
    ) => {
        try {
            setReviewsLoading(true);

            const response =
                await getProductReviews(
                    productId
                );

            const reviewList =
                response.documents as unknown as Review[];

            setReviews(reviewList);

            /* Check current customer's review */

            try {
                const user =
                    await getCurrentUser();

                const customerReview =
                    await getCustomerProductReview(
                        user.$id,
                        productId
                    );

                if (customerReview) {
                    const review =
                        customerReview as unknown as Review;

                    setMyReview(review);
                    setSelectedRating(
                        Number(review.rating)
                    );
                    setReviewText(
                        review.review || ""
                    );
                } else {
                    setMyReview(null);
                    setSelectedRating(0);
                    setReviewText("");
                }
            } catch (userError) {
                console.error(
                    "Unable to load customer review:",
                    userError
                );
            }
        } catch (error) {
            console.error(
                "Load reviews error:",
                error
            );

            setReviews([]);
        } finally {
            setReviewsLoading(false);
        }
    };

    /* ================= SUBMIT REVIEW ================= */

    const submitReview = async () => {
        if (!product) {
            return;
        }

        if (selectedRating < 1) {
            await Swal.fire({
                icon: "warning",
                title: "Rating Required",
                text: "Please select a rating from 1 to 5 stars.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }

        try {
            setReviewLoading(true);

            const user =
                await getCurrentUser();

            if (editingReview && myReview) {
                await updateReview(
                    myReview.$id,
                    {
                        rating:
                            selectedRating,
                        review:
                            reviewText.trim() ||
                            null,
                    }
                );

                await Swal.fire({
                    icon: "success",
                    title: "Review Updated",
                    text: "Your review has been updated successfully.",
                    confirmButtonColor:
                        "#0f172a",
                });

                setEditingReview(false);
            } else {
                const existingReview =
                    await getCustomerProductReview(
                        user.$id,
                        product.$id
                    );

                if (existingReview) {
                    const existing =
                        existingReview as unknown as Review;

                    setMyReview(existing);
                    setSelectedRating(
                        Number(existing.rating)
                    );
                    setReviewText(
                        existing.review || ""
                    );

                    await Swal.fire({
                        icon: "info",
                        title: "Review Already Exists",
                        text: "You have already reviewed this product. You can edit your existing review.",
                        confirmButtonColor:
                            "#0f172a",
                    });

                    return;
                }

                await createReview({
                    productId:
                        product.$id,
                    customerId:
                        user.$id,
                    rating:
                        selectedRating,
                    review:
                        reviewText.trim() ||
                        null,
                });

                await Swal.fire({
                    icon: "success",
                    title: "Review Submitted",
                    text: "Thank you! Your review has been submitted successfully.",
                    confirmButtonColor:
                        "#0f172a",
                });
            }

            await loadReviews(
                product.$id
            );
        } catch (error) {
            console.error(
                "Submit review error:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Unable to Submit Review",
                text: "Something went wrong while saving your review.",
                confirmButtonColor:
                    "#0f172a",
            });
        } finally {
            setReviewLoading(false);
        }
    };

    /* ================= DELETE REVIEW ================= */

    const handleDeleteReview = async () => {
        if (!myReview || !product) {
            return;
        }

        const result =
            await Swal.fire({
                icon: "warning",
                title: "Delete Review?",
                text: "Are you sure you want to delete your review?",
                showCancelButton: true,
                confirmButtonColor:
                    "#dc2626",
                cancelButtonColor:
                    "#64748b",
                confirmButtonText:
                    "Yes, Delete",
                cancelButtonText:
                    "Cancel",
            });

        if (!result.isConfirmed) {
            return;
        }

        try {
            setReviewLoading(true);

            await deleteReview(
                myReview.$id
            );

            setMyReview(null);
            setSelectedRating(0);
            setReviewText("");
            setEditingReview(false);

            await Swal.fire({
                icon: "success",
                title: "Review Deleted",
                text: "Your review has been deleted successfully.",
                confirmButtonColor:
                    "#0f172a",
            });

            await loadReviews(
                product.$id
            );
        } catch (error) {
            console.error(
                "Delete review error:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Unable to Delete",
                text: "Something went wrong while deleting your review.",
                confirmButtonColor:
                    "#0f172a",
            });
        } finally {
            setReviewLoading(false);
        }
    };

    /* ================= EDIT REVIEW ================= */

    const startEditingReview = () => {
        if (!myReview) {
            return;
        }

        setEditingReview(true);
        setSelectedRating(
            Number(myReview.rating)
        );
        setReviewText(
            myReview.review || ""
        );

        window.scrollTo({
            top:
                document.body.scrollHeight,
            behavior: "smooth",
        });
    };

    /* ================= CANCEL EDIT ================= */

    const cancelEditing = () => {
        setEditingReview(false);

        if (myReview) {
            setSelectedRating(
                Number(myReview.rating)
            );

            setReviewText(
                myReview.review || ""
            );
        } else {
            setSelectedRating(0);
            setReviewText("");
        }
    };

    /* ================= LOAD EVERYTHING ================= */

    useEffect(() => {
        loadProduct();
    }, []);

    useEffect(() => {
        const productId =
            getProductId();

        if (productId) {
            loadReviews(productId);
        }
    }, []);

    /* ================= LOADING ================= */

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9] px-4">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />

                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                        Loading Product
                    </p>
                </div>
            </main>
        );
    }

    /* ================= ERROR ================= */

    if (error || !product) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9] px-5">
                <div className="w-full max-w-xl border border-slate-200 bg-white px-6 py-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center border border-slate-200 bg-slate-50 text-3xl">
                        📦
                    </div>

                    <h1 className="mt-6 text-2xl font-bold text-slate-950">
                        Product Not Found
                    </h1>

                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                        This product may have been
                        removed or is no longer
                        available in the marketplace.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/marketplace"
                            )
                        }
                        className="mt-7 border border-slate-950 bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                        Back to Marketplace
                    </button>
                </div>
            </main>
        );
    }

    /* ================= RATING CALCULATION ================= */

    const totalReviews =
        reviews.length;

    const averageRating =
        totalReviews > 0
            ? reviews.reduce(
                  (sum, item) =>
                      sum +
                      Number(item.rating),
                  0
              ) / totalReviews
            : 0;

    const roundedAverage =
        Math.round(
            averageRating
        );

    const isInStock =
        product.stock > 0;

    /* ================= STAR COMPONENT ================= */

    const renderStars = (
        rating: number,
        interactive = false
    ) => {
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(
                    (star) => (
                        <button
                            key={star}
                            type={
                                interactive
                                    ? "button"
                                    : undefined
                            }
                            disabled={
                                !interactive
                            }
                            onClick={() =>
                                interactive &&
                                setSelectedRating(
                                    star
                                )
                            }
                            className={`text-2xl leading-none transition ${
                                star <= rating
                                    ? "text-[#caa66a]"
                                    : "text-slate-200"
                            } ${
                                interactive
                                    ? "cursor-pointer hover:text-[#caa66a]"
                                    : "cursor-default"
                            }`}
                            aria-label={
                                interactive
                                    ? `Rate ${star} stars`
                                    : undefined
                            }
                        >
                            ★
                        </button>
                    )
                )}
            </div>
        );
    };

    return (
        <main className="min-h-screen bg-[#f5f7f9]">
            {/* ================= HEADER ================= */}

            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto max-w-[1500px] px-5 py-5 sm:px-8 lg:px-10">
                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/marketplace"
                            )
                        }
                        className="text-sm font-medium text-slate-400 transition hover:text-slate-950"
                    >
                        ← Back to Marketplace
                    </button>
                </div>
            </header>

            {/* ================= PRODUCT DETAILS ================= */}

            <div className="mx-auto max-w-[1300px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
                <div className="grid grid-cols-1 overflow-hidden border border-slate-200 bg-white lg:grid-cols-2">
                    {/* ================= IMAGE ================= */}

                    <div className="relative min-h-[400px] bg-slate-100 lg:min-h-[650px]">
                        {product.image ? (
                            <img
                                src={product.image}
                                alt={
                                    product.productName
                                }
                                className="h-full min-h-[400px] w-full object-cover lg:min-h-[650px]"
                            />
                        ) : (
                            <div className="flex h-full min-h-[400px] items-center justify-center lg:min-h-[650px]">
                                <div className="text-center">
                                    <div className="text-7xl">
                                        📦
                                    </div>

                                    <p className="mt-3 text-sm font-medium text-slate-400">
                                        No Product Image
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* STOCK STATUS */}

                        <div className="absolute right-5 top-5">
                            {isInStock ? (
                                <span className="border border-emerald-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700 shadow-sm">
                                    In Stock
                                </span>
                            ) : (
                                <span className="border border-red-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-red-700 shadow-sm">
                                    Out of Stock
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ================= INFORMATION ================= */}

                    <div className="flex flex-col p-6 sm:p-8 lg:p-12">
                        {/* CATEGORY */}

                        <div className="flex items-center gap-3">
                            <span className="h-px w-10 bg-[#caa66a]" />

                            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                {product.category}
                            </span>
                        </div>

                        {/* NAME */}

                        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                            {
                                product.productName
                            }
                        </h1>

                        {/* RATING SUMMARY */}

                        <div className="mt-6 flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                {renderStars(
                                    roundedAverage
                                )}

                                <span className="text-sm font-bold text-slate-950">
                                    {averageRating.toFixed(
                                        1
                                    )}
                                </span>
                            </div>

                            <span className="text-xs text-slate-400">
                                {totalReviews}{" "}
                                {totalReviews ===
                                1
                                    ? "Review"
                                    : "Reviews"}
                            </span>
                        </div>

                        {/* DESCRIPTION */}

                        <div className="mt-8 border-t border-slate-100 pt-7">
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Product Description
                            </p>

                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                {product.description ||
                                    "No description has been provided for this product."}
                            </p>
                        </div>

                        {/* PRICE */}

                        <div className="mt-8 border-y border-slate-100 py-7">
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Price
                            </p>

                            <p className="mt-2 text-4xl font-bold text-slate-950">
                                ₹
                                {product.price.toLocaleString(
                                    "en-IN"
                                )}
                            </p>
                        </div>

                        {/* STOCK */}

                        <div className="mt-7 grid grid-cols-2 gap-4">
                            <div className="border border-slate-200 bg-slate-50 p-5">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Available Stock
                                </p>

                                <p className="mt-2 text-2xl font-bold text-slate-950">
                                    {
                                        product.stock
                                    }
                                </p>
                            </div>

                            <div className="border border-slate-200 bg-slate-50 p-5">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Availability
                                </p>

                                <p
                                    className={`mt-2 text-sm font-bold ${
                                        isInStock
                                            ? "text-emerald-700"
                                            : "text-red-700"
                                    }`}
                                >
                                    {isInStock
                                        ? "Available"
                                        : "Unavailable"}
                                </p>
                            </div>
                        </div>

                        {/* BUSINESS */}

                        <div className="mt-7 border border-slate-200 p-5">
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Sold By
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-950">
                                HomeMate Business
                            </p>

                            <p className="mt-1 break-all text-xs text-slate-400">
                                Business ID:{" "}
                                {
                                    product.businessId
                                }
                            </p>
                        </div>

                        {/* ACTIONS */}

                        <div className="mt-auto pt-8">
                            <button
                                type="button"
                                disabled={!isInStock}
                                onClick={addToCart}
                                className="w-full border border-slate-950 bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                {isInStock
                                    ? "Add to Cart"
                                    : "Out of Stock"}
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/dashboard/marketplace"
                                    )
                                }
                                className="mt-3 w-full border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                            >
                                Continue Shopping
                            </button>
                        </div>
                    </div>
                </div>

                {/* ================================================== */}
                {/* ================= REVIEWS SECTION ================= */}
                {/* ================================================== */}

                <section className="mt-8 border border-slate-200 bg-white">
                    {/* REVIEW HEADER */}

                    <div className="border-b border-slate-200 px-6 py-7 sm:px-8">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="h-px w-10 bg-[#caa66a]" />

                                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                        Customer Feedback
                                    </p>
                                </div>

                                <h2 className="mt-3 text-2xl font-bold text-slate-950">
                                    Reviews & Ratings
                                </h2>

                                <p className="mt-2 text-sm text-slate-500">
                                    See what customers
                                    think about this
                                    product.
                                </p>
                            </div>

                            {/* AVERAGE RATING */}

                            <div className="border border-slate-200 bg-slate-50 px-7 py-5 text-center">
                                <p className="text-3xl font-bold text-slate-950">
                                    {averageRating.toFixed(
                                        1
                                    )}
                                </p>

                                <div className="mt-1">
                                    {renderStars(
                                        roundedAverage
                                    )}
                                </div>

                                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                                    {totalReviews}{" "}
                                    {totalReviews ===
                                    1
                                        ? "Review"
                                        : "Reviews"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ================= WRITE REVIEW ================= */}

                    <div className="border-b border-slate-200 bg-[#fafbfc] px-6 py-7 sm:px-8">
                        <div className="max-w-3xl">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                        {editingReview
                                            ? "Edit Your Review"
                                            : myReview
                                              ? "Your Review"
                                              : "Write a Review"}
                                    </p>

                                    <h3 className="mt-2 text-lg font-bold text-slate-950">
                                        {editingReview
                                            ? "Update your feedback"
                                            : myReview
                                              ? "You have already reviewed this product"
                                              : "Share your experience"}
                                    </h3>
                                </div>

                                {myReview &&
                                    !editingReview && (
                                        <span className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                                            Reviewed
                                        </span>
                                    )}
                            </div>

                            {!myReview ||
                            editingReview ? (
                                <>
                                    {/* STAR SELECTOR */}

                                    <div className="mt-6">
                                        <p className="text-xs font-semibold text-slate-600">
                                            Your Rating
                                        </p>

                                        <div className="mt-2">
                                            {renderStars(
                                                selectedRating,
                                                true
                                            )}
                                        </div>

                                        <p className="mt-2 text-[11px] text-slate-400">
                                            {selectedRating ===
                                            0
                                                ? "Select a rating"
                                                : `${selectedRating} out of 5 stars`}
                                        </p>
                                    </div>

                                    {/* REVIEW TEXT */}

                                    <div className="mt-6">
                                        <label
                                            htmlFor="review"
                                            className="text-xs font-semibold text-slate-600"
                                        >
                                            Your Review
                                        </label>

                                        <textarea
                                            id="review"
                                            value={
                                                reviewText
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setReviewText(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            rows={5}
                                            maxLength={
                                                1000
                                            }
                                            placeholder="Share your experience with this product..."
                                            className="mt-2 w-full resize-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-slate-950"
                                        />

                                        <div className="mt-2 flex justify-end">
                                            <span className="text-[10px] text-slate-400">
                                                {
                                                    reviewText.length
                                                }{" "}
                                                / 1000
                                            </span>
                                        </div>
                                    </div>

                                    {/* REVIEW ACTIONS */}

                                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                        <button
                                            type="button"
                                            disabled={
                                                reviewLoading
                                            }
                                            onClick={
                                                submitReview
                                            }
                                            className="border border-slate-950 bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {reviewLoading
                                                ? "Saving..."
                                                : editingReview
                                                  ? "Update Review"
                                                  : "Submit Review"}
                                        </button>

                                        {editingReview && (
                                            <button
                                                type="button"
                                                disabled={
                                                    reviewLoading
                                                }
                                                onClick={
                                                    cancelEditing
                                                }
                                                className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* EXISTING USER REVIEW */

                                <div className="mt-6 border border-slate-200 bg-white p-5">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            {renderStars(
                                                Number(
                                                    myReview.rating
                                                )
                                            )}

                                            <p className="mt-4 text-sm leading-7 text-slate-600">
                                                {myReview.review ||
                                                    "No written review was provided."}
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={
                                                    startEditingReview
                                                }
                                                className="border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                disabled={
                                                    reviewLoading
                                                }
                                                onClick={
                                                    handleDeleteReview
                                                }
                                                className="border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:border-red-600 hover:bg-red-50 disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ================= ALL REVIEWS ================= */}

                    <div className="px-6 py-7 sm:px-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Customer Reviews
                                </p>

                                <h3 className="mt-2 text-lg font-bold text-slate-950">
                                    What customers
                                    are saying
                                </h3>
                            </div>

                            <span className="text-xs font-semibold text-slate-400">
                                {totalReviews} total
                            </span>
                        </div>

                        {/* LOADING */}

                        {reviewsLoading ? (
                            <div className="flex items-center justify-center py-14">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
                            </div>
                        ) : reviews.length ===
                          0 ? (
                            /* EMPTY REVIEWS */

                            <div className="mt-7 border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                                <div className="text-4xl">
                                    ⭐
                                </div>

                                <h4 className="mt-4 text-base font-bold text-slate-950">
                                    No reviews yet
                                </h4>

                                <p className="mt-2 text-sm text-slate-500">
                                    Be the first
                                    customer to
                                    review this
                                    product.
                                </p>
                            </div>
                        ) : (
                            /* REVIEW LIST */

                            <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
                                {reviews.map(
                                    (
                                        item
                                    ) => (
                                        <div
                                            key={
                                                item.$id
                                            }
                                            className="py-6"
                                        >
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        {renderStars(
                                                            Number(
                                                                item.rating
                                                            )
                                                        )}

                                                        {myReview?.$id ===
                                                            item.$id && (
                                                            <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500">
                                                                Your Review
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="mt-4 text-sm leading-7 text-slate-600">
                                                        {item.review ||
                                                            "No written review was provided."}
                                                    </p>

                                                    <p className="mt-4 break-all text-[10px] text-slate-400">
                                                        Customer ID:{" "}
                                                        {
                                                            item.customerId
                                                        }
                                                    </p>
                                                </div>

                                                <div className="shrink-0 text-[10px] text-slate-400">
                                                    {item.$createdAt
                                                        ? new Date(
                                                              item.$createdAt
                                                          ).toLocaleDateString(
                                                              "en-IN",
                                                              {
                                                                  day: "2-digit",
                                                                  month: "short",
                                                                  year: "numeric",
                                                              }
                                                          )
                                                        : ""}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}