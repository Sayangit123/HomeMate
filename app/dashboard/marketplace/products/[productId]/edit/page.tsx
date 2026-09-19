"use client";

import {
    ChangeEvent,
    useEffect,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import {
    Account,
    Databases,
    ID,
    Permission,
    Role,
    Storage,
} from "appwrite";
import Swal from "sweetalert2";

import client from "@/lib/appwrite/client";
import {
    getProductById,
    updateProduct,
} from "@/lib/appwrite/product";

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MEMBERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";

const PROFILE_BUCKET_ID =
    "home-mate-profiles";

const categories = [
    "Cleaning Products",
    "Electrical Accessories",
    "Plumbing Supplies",
    "Home Tools",
    "Smart Home Products",
    "Maintenance Equipment",
];

interface Product {
    $id: string;
    businessId: string;
    productName: string;
    description?: string | null;
    category: string;
    price: number;
    stock: number;
    image?: string | null;
}

export default function EditProductPage() {
    const router = useRouter();

    const [productId, setProductId] =
        useState("");

    const [userId, setUserId] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [submitting, setSubmitting] =
        useState(false);

    const [productName, setProductName] =
        useState("");

    const [description, setDescription] =
        useState("");

    const [category, setCategory] =
        useState("");

    const [price, setPrice] =
        useState("");

    const [stock, setStock] =
        useState("");

    const [existingImage, setExistingImage] =
        useState("");

    const [imageFile, setImageFile] =
        useState<File | null>(null);

    const [imagePreview, setImagePreview] =
        useState("");

    /*
     * Get product ID from the current URL.
     *
     * Example:
     * /dashboard/marketplace/products/12345/edit
     *
     * Product ID = 12345
     */
    useEffect(() => {
        const pathname =
            window.location.pathname;

        const match =
            pathname.match(
                /\/products\/([^/]+)\/edit/
            );

        if (match?.[1]) {
            setProductId(match[1]);
        } else {
            Swal.fire({
                icon: "error",
                title: "Invalid Product",
                text:
                    "Product ID could not be found.",
            }).then(() => {
                router.replace(
                    "/dashboard/marketplace/products"
                );
            });
        }
    }, [router]);

    /*
     * Load product and verify business ownership
     */
    useEffect(() => {
        if (!productId) {
            return;
        }

        const loadProduct =
            async () => {
                try {
                    setLoading(true);

                    const user =
                        await account.get();

                    setUserId(
                        user.$id
                    );

                    /*
                     * Verify that the logged-in
                     * user is a business account.
                     */
                    const memberResponse =
                        await databases.listDocuments(
                            DATABASE_ID,
                            MEMBERS_TABLE_ID
                        );

                    const member =
                        memberResponse.documents.find(
                            (item) =>
                                item.userId ===
                                user.$id
                        );

                    if (
                        !member ||
                        member.role !==
                            "business"
                    ) {
                        await Swal.fire({
                            icon: "error",
                            title: "Access Denied",
                            text:
                                "Only business accounts can edit marketplace products.",
                        });

                        router.replace(
                            "/dashboard"
                        );

                        return;
                    }

                    /*
                     * Fetch product
                     */
                    const response =
                        await getProductById(
                            productId
                        );

                    const product =
                        response as unknown as Product;

                    /*
                     * Ownership check
                     */
                    if (
                        product.businessId !==
                        user.$id
                    ) {
                        await Swal.fire({
                            icon: "error",
                            title: "Access Denied",
                            text:
                                "You can only edit products created by your business.",
                        });

                        router.replace(
                            "/dashboard/marketplace/products"
                        );

                        return;
                    }

                    /*
                     * Populate form
                     */
                    setProductName(
                        product.productName ||
                            ""
                    );

                    setDescription(
                        product.description ||
                            ""
                    );

                    setCategory(
                        product.category ||
                            ""
                    );

                    setPrice(
                        String(
                            product.price ??
                                ""
                        )
                    );

                    setStock(
                        String(
                            product.stock ??
                                ""
                        )
                    );

                    setExistingImage(
                        product.image ||
                            ""
                    );
                } catch (error) {
                    console.error(
                        "Load product error:",
                        error
                    );

                    await Swal.fire({
                        icon: "error",
                        title: "Product Not Found",
                        text:
                            "Unable to load this product.",
                    });

                    router.replace(
                        "/dashboard/marketplace/products"
                    );
                } finally {
                    setLoading(false);
                }
            };

        loadProduct();
    }, [productId, router]);

    /*
     * Handle new product image
     */
    const handleImageChange = (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
        ];

        if (
            !allowedTypes.includes(
                file.type
            )
        ) {
            Swal.fire({
                icon: "error",
                title: "Invalid Image",
                text:
                    "Please upload JPG, JPEG, PNG, or WEBP image.",
            });

            event.target.value = "";

            return;
        }

        if (
            file.size >
            10 * 1024 * 1024
        ) {
            Swal.fire({
                icon: "error",
                title: "Image Too Large",
                text:
                    "Image size must be less than 10MB.",
            });

            event.target.value = "";

            return;
        }

        setImageFile(file);

        const previewUrl =
            URL.createObjectURL(file);

        setImagePreview(
            previewUrl
        );
    };

    /*
     * Upload replacement product image
     */
    const uploadProductImage =
        async () => {
            if (!imageFile) {
                return null;
            }

            if (!userId) {
                throw new Error(
                    "User ID is missing."
                );
            }

            const fileId =
                ID.unique();

            const uploadedFile =
                await storage.createFile(
                    PROFILE_BUCKET_ID,
                    fileId,
                    imageFile,
                    [
                        Permission.read(
                            Role.users()
                        ),
                        Permission.update(
                            Role.user(userId)
                        ),
                        Permission.delete(
                            Role.user(userId)
                        ),
                    ]
                );

            const fileUrl =
                storage.getFileView(
                    PROFILE_BUCKET_ID,
                    uploadedFile.$id
                );

            return String(
                fileUrl
            );
        };

    /*
     * Update product
     */
    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (!productName.trim()) {
            Swal.fire({
                icon: "warning",
                title: "Product Name Required",
                text:
                    "Please enter a product name.",
            });

            return;
        }

        if (!category) {
            Swal.fire({
                icon: "warning",
                title: "Category Required",
                text:
                    "Please select a product category.",
            });

            return;
        }

        const priceValue =
            Number(price);

        if (
            price === "" ||
            Number.isNaN(priceValue) ||
            priceValue < 0
        ) {
            Swal.fire({
                icon: "warning",
                title: "Invalid Price",
                text:
                    "Please enter a valid product price.",
            });

            return;
        }

        const stockValue =
            Number(stock);

        if (
            stock === "" ||
            Number.isNaN(stockValue) ||
            stockValue < 0 ||
            !Number.isInteger(
                stockValue
            )
        ) {
            Swal.fire({
                icon: "warning",
                title: "Invalid Stock",
                text:
                    "Stock must be a whole number greater than or equal to 0.",
            });

            return;
        }

        if (!productId) {
            Swal.fire({
                icon: "error",
                title: "Product ID Missing",
                text:
                    "Unable to identify the product.",
            });

            return;
        }

        try {
            setSubmitting(true);

            let imageUrl:
                | string
                | null =
                existingImage ||
                null;

            /*
             * Only upload a new image
             * if the user selected one.
             */
            if (imageFile) {
                imageUrl =
                    await uploadProductImage();
            }

            await updateProduct(
                productId,
                {
                    productName:
                        productName.trim(),

                    description:
                        description.trim() ||
                        null,

                    category,

                    price: priceValue,

                    stock: stockValue,

                    image: imageUrl,
                }
            );

            await Swal.fire({
                icon: "success",
                title: "Product Updated",
                text:
                    "Your product has been updated successfully.",
                confirmButtonText:
                    "View Products",
            });

            router.push(
                "/dashboard/marketplace/products"
            );
        } catch (error) {
            console.error(
                "Update product error:",
                error
            );

            Swal.fire({
                icon: "error",
                title: "Update Failed",
                text:
                    "Something went wrong while updating the product.",
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-white" />

                    <p className="text-slate-400">
                        Loading product...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">

                {/* Header */}
                <div className="mb-8">
                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/marketplace/products"
                            )
                        }
                        className="mb-5 text-sm font-medium text-slate-400 transition hover:text-white"
                    >
                        ← Back to My Products
                    </button>

                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        HomeMate Marketplace
                    </p>

                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        Edit Product
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                        Update the information
                        of your marketplace
                        product.
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={
                        handleSubmit
                    }
                    className="border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-8"
                >
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold">
                            Product Information
                        </h2>

                        <p className="mt-1 text-sm text-slate-400">
                            Modify the product
                            details below.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">

                        {/* Product Name */}
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Product Name
                            </label>

                            <input
                                type="text"
                                value={
                                    productName
                                }
                                onChange={(
                                    event
                                ) =>
                                    setProductName(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                maxLength={150}
                                placeholder="Enter product name"
                                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Category
                            </label>

                            <select
                                value={
                                    category
                                }
                                onChange={(
                                    event
                                ) =>
                                    setCategory(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
                            >
                                <option value="">
                                    Select Category
                                </option>

                                {categories.map(
                                    (
                                        item
                                    ) => (
                                        <option
                                            key={
                                                item
                                            }
                                            value={
                                                item
                                            }
                                        >
                                            {
                                                item
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        {/* Price */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Price (₹)
                            </label>

                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                    price
                                }
                                onChange={(
                                    event
                                ) =>
                                    setPrice(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                placeholder="Enter price"
                                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
                            />
                        </div>

                        {/* Stock */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Stock Quantity
                            </label>

                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                    stock
                                }
                                onChange={(
                                    event
                                ) =>
                                    setStock(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                placeholder="Enter stock quantity"
                                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
                            />
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Description
                            </label>

                            <textarea
                                value={
                                    description
                                }
                                onChange={(
                                    event
                                ) =>
                                    setDescription(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                rows={5}
                                placeholder="Describe the product..."
                                className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
                            />
                        </div>

                        {/* Existing / New Image */}
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Product Image
                            </label>

                            {existingImage &&
                                !imagePreview && (
                                    <div className="mb-5">
                                        <p className="mb-2 text-sm text-slate-400">
                                            Current
                                            Image
                                        </p>

                                        <div className="h-56 w-full overflow-hidden border border-slate-800 bg-slate-950 sm:w-72">
                                            <img
                                                src={
                                                    existingImage
                                                }
                                                alt={
                                                    productName
                                                }
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    </div>
                                )}

                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                onChange={
                                    handleImageChange
                                }
                                className="block w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                            />

                            <p className="mt-2 text-xs text-slate-500">
                                Upload a new image
                                only if you want
                                to replace the
                                current image.
                                JPG, JPEG, PNG or
                                WEBP, maximum
                                10MB.
                            </p>

                            {imagePreview && (
                                <div className="mt-5">
                                    <p className="mb-2 text-sm text-slate-400">
                                        New Image
                                        Preview
                                    </p>

                                    <div className="h-56 w-full overflow-hidden border border-slate-800 bg-slate-950 sm:w-72">
                                        <img
                                            src={
                                                imagePreview
                                            }
                                            alt="New product preview"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="mt-10 flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            disabled={
                                submitting
                            }
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace/products"
                                )
                            }
                            className="border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={
                                submitting
                            }
                            className="bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting
                                ? "Updating Product..."
                                : "Update Product"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}