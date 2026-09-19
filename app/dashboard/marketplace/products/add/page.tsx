"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
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
import { createProduct } from "@/lib/appwrite/product";

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

export default function AddProductPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [userId, setUserId] = useState("");

    const [productName, setProductName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("");

    const [imageFile, setImageFile] =
        useState<File | null>(null);

    const [imagePreview, setImagePreview] =
        useState("");

    useEffect(() => {
        const checkBusinessAccess =
            async () => {
                try {
                    const user =
                        await account.get();

                    const response =
                        await databases.listDocuments(
                            DATABASE_ID,
                            MEMBERS_TABLE_ID
                        );

                    const member =
                        response.documents.find(
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
                                "Only business accounts can add marketplace products.",
                        });

                        router.replace(
                            "/dashboard"
                        );

                        return;
                    }

                    setUserId(user.$id);
                } catch (error) {
                    console.error(
                        "Business access check failed:",
                        error
                    );

                    await Swal.fire({
                        icon: "error",
                        title: "Authentication Error",
                        text:
                            "Unable to verify your account.",
                    });

                    router.replace(
                        "/login"
                    );
                } finally {
                    setLoading(false);
                }
            };

        checkBusinessAccess();
    }, [router]);

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

        setImagePreview(previewUrl);
    };

    const uploadProductImage =
        async () => {
            if (!imageFile) {
                return null;
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

            return String(fileUrl);
        };

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
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
            !Number.isInteger(stockValue)
        ) {
            Swal.fire({
                icon: "warning",
                title: "Invalid Stock",
                text:
                    "Stock must be a whole number greater than or equal to 0.",
            });
            return;
        }

        if (!userId) {
            Swal.fire({
                icon: "error",
                title: "User Not Found",
                text:
                    "Unable to identify the business account.",
            });
            return;
        }

        try {
            setSubmitting(true);

            let imageUrl:
                | string
                | null = null;

            if (imageFile) {
                imageUrl =
                    await uploadProductImage();
            }

            await createProduct({
                businessId: userId,
                productName:
                    productName.trim(),
                description:
                    description.trim() ||
                    null,
                category,
                price: priceValue,
                stock: stockValue,
                image: imageUrl,
            });

            await Swal.fire({
                icon: "success",
                title: "Product Added",
                text:
                    "Your product has been added successfully.",
                confirmButtonText: "View Products",
            });

            router.push(
                "/dashboard/marketplace/products"
            );
        } catch (error) {
            console.error(
                "Create product error:",
                error
            );

            Swal.fire({
                icon: "error",
                title: "Failed to Add Product",
                text:
                    "Something went wrong while adding the product.",
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-white" />

                    <p className="text-slate-300">
                        Checking business
                        account...
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
                                "/dashboard"
                            )
                        }
                        className="mb-5 text-sm font-medium text-slate-400 transition hover:text-white"
                    >
                        ← Back to Dashboard
                    </button>

                    <div>
                        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                            HomeMate Marketplace
                        </p>

                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Add New Product
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                            Add a home-maintenance
                            product that customers
                            can discover and purchase
                            from your business.
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className="border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-8"
                >
                    {/* Product Information */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold">
                            Product Information
                        </h2>

                        <p className="mt-1 text-sm text-slate-400">
                            Provide the basic details
                            of your product.
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
                                value={productName}
                                onChange={(event) =>
                                    setProductName(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="Enter product name"
                                maxLength={150}
                                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Category
                            </label>

                            <select
                                value={category}
                                onChange={(event) =>
                                    setCategory(
                                        event.target
                                            .value
                                    )
                                }
                                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
                            >
                                <option value="">
                                    Select Category
                                </option>

                                {categories.map(
                                    (item) => (
                                        <option
                                            key={
                                                item
                                            }
                                            value={
                                                item
                                            }
                                        >
                                            {item}
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
                                value={price}
                                onChange={(event) =>
                                    setPrice(
                                        event.target
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
                                value={stock}
                                onChange={(event) =>
                                    setStock(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="Enter available stock"
                                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
                            />
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Description
                            </label>

                            <textarea
                                value={description}
                                onChange={(event) =>
                                    setDescription(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="Describe the product..."
                                rows={5}
                                className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
                            />
                        </div>

                        {/* Product Image */}
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                                Product Image
                            </label>

                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                onChange={
                                    handleImageChange
                                }
                                className="block w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                            />

                            <p className="mt-2 text-xs text-slate-500">
                                JPG, JPEG, PNG or WEBP.
                                Maximum 10MB.
                            </p>

                            {imagePreview && (
                                <div className="mt-5">
                                    <p className="mb-2 text-sm text-slate-400">
                                        Image Preview
                                    </p>

                                    <div className="h-56 w-full overflow-hidden border border-slate-800 bg-slate-950 sm:w-72">
                                        <img
                                            src={
                                                imagePreview
                                            }
                                            alt="Product preview"
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
                            onClick={() =>
                                router.push(
                                    "/dashboard/marketplace/products"
                                )
                            }
                            disabled={
                                submitting
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
                                ? "Adding Product..."
                                : "Add Product"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}