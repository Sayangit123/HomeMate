"use client";

import {
    useEffect,
    useMemo,
} from "react";

import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { useRouter } from "next/navigation";

import Swal from "sweetalert2";

import {
    Databases,
    Query,
} from "appwrite";

import client from "@/lib/appwrite/client";

import {
    getCurrentUser,
} from "@/lib/appwrite/account";

import {
    createWarranty,
    getWarrantyByBookingId,
} from "@/lib/appwrite/warranty";

import {
    getServiceById,
} from "@/lib/appwrite/service";

import {
    useWarrantyStore,
} from "@/lib/stores/warranty-store";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const BOOKINGS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_BOOKINGS_TABLE_ID ||
    "bookings";

interface Booking {
    $id: string;
    customerId: string;
    professionalId: string;
    propertyId: string;
    serviceId: string;
    bookingDate: string;
    bookingTime: string;
    status: string;
    amount: number;
}

interface Service {
    $id: string;
    serviceName?: string;
    name?: string;
    title?: string;
}

interface ExistingWarranty {
    $id: string;
    bookingId: string;
    customerId: string;
    propertyId: string;
    serviceId: string;
    professionalId: string;
    warrantyPeriod: string;
    warrantyStartDate: string;
    warrantyExpiryDate: string;
    warrantyTerms?: string | null;
    status:
        | "Active"
        | "Expired"
        | "Claimed"
        | "Cancelled";
}

export default function AddWarrantyPage() {
    const router = useRouter();

    const queryClient =
        useQueryClient();

    const {
        selectedBookingId,
        warrantyPeriod,
        warrantyStartDate,
        warrantyExpiryDate,
        warrantyTerms,
        status,
        setSelectedBookingId,
        setWarrantyPeriod,
        setWarrantyStartDate,
        setWarrantyExpiryDate,
        setWarrantyTerms,
        setStatus,
        resetForm,
    } = useWarrantyStore();

    const completedBookingsQuery =
        useQuery({
            queryKey: [
                "warranty",
                "completed-bookings",
            ],
            queryFn: async () => {
                const user =
                    await getCurrentUser();

                const response =
                    await databases.listDocuments(
                        DATABASE_ID,
                        BOOKINGS_TABLE_ID,
                        [
                            Query.equal(
                                "professionalId",
                                user.$id
                            ),
                            Query.equal(
                                "status",
                                "Completed"
                            ),
                            Query.orderDesc(
                                "$createdAt"
                            ),
                        ]
                    );

                const bookingDocuments =
                    response.documents as unknown as Booking[];

                const serviceEntries =
                    await Promise.all(
                        bookingDocuments.map(
                            async (booking) => {
                                try {
                                    const service =
                                        await getServiceById(
                                            booking.serviceId
                                        );

                                    return [
                                        booking.serviceId,
                                        service as Service,
                                    ] as const;
                                } catch {
                                    return [
                                        booking.serviceId,
                                        {
                                            $id:
                                                booking.serviceId,
                                            serviceName:
                                                "Service",
                                        } as Service,
                                    ] as const;
                                }
                            }
                        )
                    );

                return {
                    bookings:
                        bookingDocuments,
                    services:
                        Object.fromEntries(
                            serviceEntries
                        ) as Record<
                            string,
                            Service
                        >,
                };
            },
        });

    const bookings =
        completedBookingsQuery.data?.bookings ||
        [];

    const services =
        completedBookingsQuery.data?.services ||
        {};

    const loading =
        completedBookingsQuery.isLoading;

    const selectedBooking =
        useMemo(() => {
            return bookings.find(
                (booking) =>
                    booking.$id ===
                    selectedBookingId
            );
        }, [
            bookings,
            selectedBookingId,
        ]);

    const selectedService =
        selectedBooking
            ? services[
                  selectedBooking.serviceId
              ]
            : undefined;

    const getServiceName = (
        service?: Service
    ) => {
        if (!service) {
            return "Service";
        }

        return (
            service.serviceName ||
            service.name ||
            service.title ||
            "Service"
        );
    };

    const formatDate = (
        date: string
    ) => {
        if (!date) {
            return "—";
        }

        return new Date(
            date
        ).toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

    const warrantyByBookingQuery =
        useQuery({
            queryKey: [
                "warranty",
                "by-booking",
                selectedBookingId,
            ],
            queryFn: async () => {
                if (!selectedBookingId) {
                    return null;
                }

                return await getWarrantyByBookingId(
                    selectedBookingId
                );
            },
            enabled:
                Boolean(
                    selectedBookingId
                ),
        });

    const existingWarranty =
        (warrantyByBookingQuery.data as unknown as ExistingWarranty | null) ||
        null;

    useEffect(() => {
        if (!selectedBookingId) {
            return;
        }

        if (!existingWarranty) {
            return;
        }

        setWarrantyPeriod(
            existingWarranty.warrantyPeriod ||
                ""
        );

        setWarrantyStartDate(
            existingWarranty.warrantyStartDate
                ? existingWarranty.warrantyStartDate.slice(
                      0,
                      10
                  )
                : ""
        );

        setWarrantyExpiryDate(
            existingWarranty.warrantyExpiryDate
                ? existingWarranty.warrantyExpiryDate.slice(
                      0,
                      10
                  )
                : ""
        );

        setWarrantyTerms(
            existingWarranty.warrantyTerms ||
                ""
        );

        setStatus(
            existingWarranty.status
        );
    }, [
        selectedBookingId,
        existingWarranty,
        setWarrantyPeriod,
        setWarrantyStartDate,
        setWarrantyExpiryDate,
        setWarrantyTerms,
        setStatus,
    ]);

    const handleBookingChange = (
        bookingId: string
    ) => {
        setSelectedBookingId(
            bookingId
        );
        setWarrantyPeriod("");
        setWarrantyStartDate("");
        setWarrantyExpiryDate("");
        setWarrantyTerms("");
        setStatus("Active");
    };

    const createWarrantyMutation =
        useMutation({
            mutationFn:
                async () => {
                    if (!selectedBooking) {
                        throw new Error(
                            "Please select a completed booking first."
                        );
                    }

                    const user =
                        await getCurrentUser();

                    return await createWarranty({
                        bookingId:
                            selectedBooking.$id,
                        customerId:
                            selectedBooking.customerId,
                        propertyId:
                            selectedBooking.propertyId,
                        serviceId:
                            selectedBooking.serviceId,
                        professionalId:
                            user.$id,
                        warrantyPeriod:
                            warrantyPeriod.trim(),
                        warrantyStartDate:
                            new Date(
                                `${warrantyStartDate}T00:00:00`
                            ).toISOString(),
                        warrantyExpiryDate:
                            new Date(
                                `${warrantyExpiryDate}T23:59:59`
                            ).toISOString(),
                        warrantyTerms:
                            warrantyTerms.trim() ||
                            null,
                        status,
                    });
                },
            onSuccess:
                async () => {
                    await queryClient.invalidateQueries({
                        queryKey: [
                            "service-history",
                        ],
                    });

                    await queryClient.invalidateQueries({
                        queryKey: [
                            "warranty",
                            "by-booking",
                            selectedBookingId,
                        ],
                    });

                    await Swal.fire({
                        icon: "success",
                        title: "Warranty Added",
                        text:
                            "Warranty information has been saved successfully.",
                        confirmButtonText:
                            "Continue",
                    });

                    resetForm();

                    router.push(
                        "/dashboard/service-history"
                    );
                },
            onError:
                (error) => {
                    console.error(
                        "Failed to create warranty:",
                        error
                    );

                    Swal.fire({
                        icon: "error",
                        title:
                            "Failed to save warranty",
                        text:
                            "Something went wrong while saving the warranty information.",
                    });
                },
        });

    const handleSubmit = async () => {
        if (!selectedBooking) {
            await Swal.fire({
                icon: "warning",
                title: "Select a booking",
                text:
                    "Please select a completed booking first.",
            });
            return;
        }

        if (!warrantyPeriod.trim()) {
            await Swal.fire({
                icon: "warning",
                title:
                    "Warranty period required",
                text:
                    "Please enter the warranty period.",
            });
            return;
        }

        if (!warrantyStartDate) {
            await Swal.fire({
                icon: "warning",
                title:
                    "Start date required",
                text:
                    "Please select the warranty start date.",
            });
            return;
        }

        if (!warrantyExpiryDate) {
            await Swal.fire({
                icon: "warning",
                title:
                    "Expiry date required",
                text:
                    "Please select the warranty expiry date.",
            });
            return;
        }

        const startDate =
            new Date(
                warrantyStartDate
            );

        const expiryDate =
            new Date(
                warrantyExpiryDate
            );

        if (
            expiryDate <=
            startDate
        ) {
            await Swal.fire({
                icon: "warning",
                title:
                    "Invalid dates",
                text:
                    "Warranty expiry date must be after the start date.",
            });
            return;
        }

        if (existingWarranty) {
            await Swal.fire({
                icon: "info",
                title:
                    "Warranty already exists",
                text:
                    "A warranty already exists for this booking. Updating existing warranties will be added in the next step.",
            });
            return;
        }

        await createWarrantyMutation.mutateAsync();
    };

    const saving =
        createWarrantyMutation.isPending;

    if (completedBookingsQuery.isError) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center bg-red-50 text-2xl">
                        ⚠️
                    </div>

                    <h2 className="text-xl font-bold text-slate-900">
                        Unable to load bookings
                    </h2>

                    <p className="mt-2 text-sm text-slate-600">
                        Completed bookings could not be loaded.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            completedBookingsQuery.refetch()
                        }
                        className="mt-6 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                        Try Again
                    </button>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />

                    <p className="text-sm font-medium text-slate-600">
                        Loading completed
                        bookings...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                            Professional Panel
                        </p>

                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Add Warranty
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            Add warranty coverage
                            details for a completed
                            service booking.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/service-history"
                            )
                        }
                        className="border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                        Back to Service History
                    </button>
                </div>

                {/* No bookings */}
                {bookings.length === 0 ? (
                    <div className="border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center bg-slate-100 text-2xl">
                            🧾
                        </div>

                        <h2 className="text-xl font-bold text-slate-900">
                            No Completed
                            Bookings
                        </h2>

                        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                            You need at least one
                            completed booking before
                            you can add warranty
                            information.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/bookings"
                                )
                            }
                            className="mt-6 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            View My Bookings
                        </button>
                    </div>
                ) : (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void handleSubmit();
                        }}
                        className="space-y-6"
                    >
                        {/* Booking Selection */}
                        <section className="border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-5">
                                <h2 className="text-lg font-bold text-slate-900">
                                    Select Completed
                                    Booking
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Choose the service for
                                    which you want to
                                    provide warranty
                                    coverage.
                                </p>
                            </div>

                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Completed Booking
                                <span className="ml-1 text-rose-500">
                                    *
                                </span>
                            </label>

                            <select
                                value={
                                    selectedBookingId
                                }
                                onChange={(event) =>
                                    handleBookingChange(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                className="w-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                            >
                                <option value="">
                                    Select a completed
                                    booking
                                </option>

                                {bookings.map(
                                    (booking) => {
                                        const service =
                                            services[
                                                booking
                                                    .serviceId
                                            ];

                                        return (
                                            <option
                                                key={
                                                    booking.$id
                                                }
                                                value={
                                                    booking.$id
                                                }
                                            >
                                                {
                                                    getServiceName(
                                                        service
                                                    )
                                                }{" "}
                                                —{" "}
                                                {formatDate(
                                                    booking.bookingDate
                                                )}{" "}
                                                — ₹
                                                {booking.amount ||
                                                    0}
                                            </option>
                                        );
                                    }
                                )}
                            </select>

                            {selectedBooking && (
                                <div className="mt-5 grid gap-4 border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Service
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-900">
                                            {getServiceName(
                                                selectedService
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Service Date
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-900">
                                            {formatDate(
                                                selectedBooking.bookingDate
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Booking Time
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-900">
                                            {selectedBooking.bookingTime ||
                                                "—"}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Amount
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-900">
                                            ₹
                                            {selectedBooking.amount ||
                                                0}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {existingWarranty && (
                                <div className="mt-5 border border-amber-200 bg-amber-50 p-4">
                                    <p className="text-sm font-bold text-amber-800">
                                        Warranty already
                                        exists
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-amber-700">
                                        This booking already
                                        has a warranty
                                        record. The existing
                                        information has been
                                        loaded below.
                                    </p>
                                </div>
                            )}
                        </section>

                        {/* Warranty Details */}
                        <section className="border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-5">
                                <h2 className="text-lg font-bold text-slate-900">
                                    Warranty Details
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Enter the actual warranty
                                    information provided for
                                    this service.
                                </p>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                {/* Period */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Warranty Period
                                        <span className="ml-1 text-rose-500">
                                            *
                                        </span>
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            warrantyPeriod
                                        }
                                        onChange={(event) =>
                                            setWarrantyPeriod(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder="e.g. 6 Months"
                                        className="w-full border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                    />
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Warranty Status
                                        <span className="ml-1 text-rose-500">
                                            *
                                        </span>
                                    </label>

                                    <select
                                        value={
                                            status
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setStatus(
                                                event
                                                    .target
                                                    .value as
                                                    | "Active"
                                                    | "Expired"
                                                    | "Claimed"
                                                    | "Cancelled"
                                            )
                                        }
                                        className="w-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                    >
                                        <option value="Active">
                                            Active
                                        </option>

                                        <option value="Expired">
                                            Expired
                                        </option>

                                        <option value="Claimed">
                                            Claimed
                                        </option>

                                        <option value="Cancelled">
                                            Cancelled
                                        </option>
                                    </select>
                                </div>

                                {/* Start Date */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Warranty Start
                                        Date
                                        <span className="ml-1 text-rose-500">
                                            *
                                        </span>
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            warrantyStartDate
                                        }
                                        onChange={(event) =>
                                            setWarrantyStartDate(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                    />
                                </div>

                                {/* Expiry Date */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Warranty Expiry
                                        Date
                                        <span className="ml-1 text-rose-500">
                                            *
                                        </span>
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            warrantyExpiryDate
                                        }
                                        onChange={(event) =>
                                            setWarrantyExpiryDate(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                    />
                                </div>
                            </div>

                            {/* Terms */}
                            <div className="mt-5">
                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Warranty Terms
                                </label>

                                <textarea
                                    value={
                                        warrantyTerms
                                    }
                                    onChange={(event) =>
                                        setWarrantyTerms(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    rows={5}
                                    placeholder="Enter warranty terms, coverage details, exclusions, parts covered, labour coverage, etc."
                                    className="w-full resize-none border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                                />

                                <p className="mt-2 text-xs text-slate-500">
                                    Example: Covers repair
                                    workmanship and replaced
                                    parts for the stated
                                    warranty period.
                                </p>
                            </div>
                        </section>

                        {/* Preview */}
                        {selectedBooking && (
                            <section className="border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-5">
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Warranty Preview
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500">
                                        This information will
                                        appear in the
                                        customer's service
                                        history.
                                    </p>
                                </div>

                                <div className="border border-slate-200 bg-slate-50 p-5">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Service
                                            </p>

                                            <h3 className="mt-1 text-xl font-bold text-slate-900">
                                                {getServiceName(
                                                    selectedService
                                                )}
                                            </h3>
                                        </div>

                                        <span className="inline-flex w-fit border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                                            {status}
                                        </span>
                                    </div>

                                    <div className="mt-6 grid gap-5 sm:grid-cols-3">
                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                Period
                                            </p>

                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {warrantyPeriod ||
                                                    "Not provided"}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                Start
                                            </p>

                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {warrantyStartDate
                                                    ? formatDate(
                                                          warrantyStartDate
                                                      )
                                                    : "Not provided"}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                Expiry
                                            </p>

                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {warrantyExpiryDate
                                                    ? formatDate(
                                                          warrantyExpiryDate
                                                      )
                                                    : "Not provided"}
                                            </p>
                                        </div>
                                    </div>

                                    {warrantyTerms.trim() && (
                                        <div className="mt-6 border-t border-slate-200 pt-5">
                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                Warranty Terms
                                            </p>

                                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                                                {
                                                    warrantyTerms
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/dashboard/service-history"
                                    )
                                }
                                className="border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={
                                    saving ||
                                    !!existingWarranty
                                }
                                className="bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving
                                    ? "Saving Warranty..."
                                    : existingWarranty
                                    ? "Warranty Already Added"
                                    : "Save Warranty"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </main>
    );
}