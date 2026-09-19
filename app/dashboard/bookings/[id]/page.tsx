"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";

import { getCurrentUser } from "@/lib/appwrite/account";

import {
    getCustomerBookings,
} from "@/lib/appwrite/booking";

import {
    getServiceById,
} from "@/lib/appwrite/service";

import {
    getPropertyById,
} from "@/lib/appwrite/property";

import {
    getAllMembers,
} from "@/lib/appwrite/member";

/* ============================================================
   TYPES
============================================================ */

interface Booking {
    $id: string;

    customerId: string;
    professionalId: string;
    serviceId: string;
    propertyId: string;

    bookingDate: string;
    bookingTime: string;

    status:
        | "Requested"
        | "Accepted"
        | "InProgress"
        | "Completed"
        | "Cancelled";

    notes?: string | null;
}

interface Service {
    $id: string;

    userId: string;

    serviceName: string;

    description?: string | null;

    duration?: number;

    price?: number;
}

interface Property {
    $id: string;

    userId?: string;

    propertyName?: string;

    propertyType?: string;

    address?: string;
}

interface Member {
    $id: string;

    userId: string;

    fullName: string;

    phone?: string | null;

    role:
        | "customer"
        | "professional"
        | "business"
        | "admin";

    verificationStatus?: string;
}

/* ============================================================
   HELPERS
============================================================ */

const formatDate = (
    dateValue: string
) => {
    if (!dateValue) {
        return "—";
    }

    try {
        const date = new Date(
            dateValue
        );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return dateValue;
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    } catch {
        return dateValue;
    }
};

const formatTime = (
    timeValue: string
) => {
    if (!timeValue) {
        return "—";
    }

    try {
        const date = new Date(
            `1970-01-01T${timeValue}`
        );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return timeValue;
        }

        return date.toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    } catch {
        return timeValue;
    }
};

const getStatusLabel = (
    status: Booking["status"]
) => {
    if (status === "InProgress") {
        return "In Progress";
    }

    return status;
};

const getStatusClasses = (
    status: Booking["status"]
) => {
    switch (status) {
        case "Requested":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "Accepted":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "InProgress":
            return "border-purple-200 bg-purple-50 text-purple-700";

        case "Completed":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "Cancelled":
            return "border-red-200 bg-red-50 text-red-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
};

/* ============================================================
   PAGE
============================================================ */

export default function BookingDetailsPage() {
    const params = useParams();

    const bookingId =
        typeof params?.id === "string"
            ? params.id
            : "";

    /* ========================================================
       TANSTACK QUERY
    ======================================================== */

    const bookingQuery = useQuery({
        queryKey: [
            "booking-details",
            bookingId,
        ],

        enabled:
            Boolean(bookingId),

        queryFn: async () => {
            const user =
                await getCurrentUser();

            /*
             * Get only the current customer's
             * bookings.
             */
            const bookingResponse =
                await getCustomerBookings(
                    user.$id
                );

            const bookings =
                bookingResponse.documents as unknown as Booking[];

            /*
             * Find the booking selected
             * from the URL.
             */
            const booking =
                bookings.find(
                    (item) =>
                        item.$id ===
                        bookingId
                );

            /*
             * Security check:
             * The booking must belong to
             * the currently logged-in user.
             */
            if (!booking) {
                throw new Error(
                    "Booking not found or you do not have access to this booking."
                );
            }

            /* =================================================
               LOAD RELATED DATA
            ================================================= */

            const [
                service,
                property,
                membersResponse,
            ] = await Promise.all([
                getServiceById(
                    booking.serviceId
                ) as Promise<
                    unknown
                >,

                getPropertyById(
                    booking.propertyId
                ) as Promise<
                    unknown
                >,

                getAllMembers(),
            ]);

            const professionalMembers =
                membersResponse.documents as unknown as Member[];

            const professional =
                professionalMembers.find(
                    (member) =>
                        member.userId ===
                        booking.professionalId
                );

            return {
                booking,
                service:
                    service as Service,
                property:
                    property as Property,
                professional,
            };
        },

        retry: 1,
    });

    /* ========================================================
       STATES
    ======================================================== */

    if (bookingQuery.isLoading) {
        return (
            <main className="min-h-screen bg-[#f5f7f9] text-slate-950">

                <header className="border-b border-slate-200 bg-white">

                    <div className="mx-auto flex min-h-[82px] max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-10">

                        <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                                H
                            </div>

                            <div>

                                <h1 className="text-lg font-bold tracking-tight">
                                    HomeMate
                                </h1>

                                <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-400">
                                    Home Services Platform
                                </p>

                            </div>

                        </div>

                    </div>

                </header>

                <div className="mx-auto flex min-h-[70vh] max-w-[1400px] items-center justify-center px-5">

                    <div className="text-center">

                        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />

                        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                            Loading booking
                        </p>

                    </div>

                </div>

            </main>
        );
    }

    /* ========================================================
       ERROR
    ======================================================== */

    if (
        bookingQuery.isError ||
        !bookingQuery.data
    ) {
        return (
            <main className="min-h-screen bg-[#f5f7f9] text-slate-950">

                <header className="border-b border-slate-200 bg-white">

                    <div className="mx-auto flex min-h-[82px] max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-10">

                        <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                                H
                            </div>

                            <div>

                                <h1 className="text-lg font-bold tracking-tight">
                                    HomeMate
                                </h1>

                                <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-400">
                                    Home Services Platform
                                </p>

                            </div>

                        </div>

                        <Link
                            href="/dashboard"
                            className="border border-slate-200 px-4 py-3 text-[10px] font-bold text-slate-600 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                        >
                            ← Dashboard
                        </Link>

                    </div>

                </header>

                <div className="mx-auto flex min-h-[70vh] max-w-[1400px] items-center justify-center px-5">

                    <section className="w-full max-w-lg border border-slate-200 bg-white p-8 text-center">

                        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-red-200 bg-red-50 text-2xl">
                            !
                        </div>

                        <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.25em] text-red-500">
                            Booking Not Found
                        </p>

                        <h2 className="mt-2 text-2xl font-bold text-slate-950">
                            Unable to open this booking
                        </h2>

                        <p className="mx-auto mt-3 max-w-md text-xs leading-6 text-slate-500">
                            This booking may no longer
                            exist, or you may not have
                            permission to view it.
                        </p>

                        <div className="mt-6 flex flex-wrap justify-center gap-3">

                            <Link
                                href="/dashboard/bookings"
                                className="bg-slate-950 px-5 py-3 text-[10px] font-bold text-white transition hover:bg-slate-800"
                            >
                                View My Bookings
                            </Link>

                            <Link
                                href="/dashboard"
                                className="border border-slate-200 px-5 py-3 text-[10px] font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-50"
                            >
                                Dashboard
                            </Link>

                        </div>

                    </section>

                </div>

            </main>
        );
    }

    /* ========================================================
       DATA
    ======================================================== */

    const {
        booking,
        service,
        property,
        professional,
    } = bookingQuery.data;

    const statusClasses =
        getStatusClasses(
            booking.status
        );

    /* ========================================================
       CANCELLED / COMPLETED LABEL
    ======================================================== */

    const statusMessage =
        booking.status ===
        "Completed"
            ? "This service has been completed successfully."
            : booking.status ===
              "Cancelled"
            ? "This booking has been cancelled."
            : "Your service booking is currently active.";

    /* ========================================================
       UI
    ======================================================== */

    return (
        <main className="min-h-screen bg-[#f5f7f9] text-slate-950">

            {/* ====================================================
                HEADER
            ==================================================== */}

            <header className="border-b border-slate-200 bg-white">

                <div className="mx-auto flex min-h-[82px] max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-10">

                    <div className="flex items-center gap-3">

                        <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                            H
                        </div>

                        <div>

                            <h1 className="text-lg font-bold tracking-tight">
                                HomeMate
                            </h1>

                            <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-400">
                                Home Services Platform
                            </p>

                        </div>

                    </div>

                    <div className="flex items-center gap-2">

                        <Link
                            href="/dashboard/bookings"
                            className="hidden border border-slate-200 px-4 py-3 text-[10px] font-bold text-slate-600 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white sm:block"
                        >
                            My Bookings
                        </Link>

                        <Link
                            href="/dashboard"
                            className="border border-slate-200 px-4 py-3 text-[10px] font-bold text-slate-600 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                        >
                            ← Dashboard
                        </Link>

                    </div>

                </div>

            </header>

            {/* ====================================================
                CONTENT
            ==================================================== */}

            <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 lg:px-10">

                {/* =================================================
                    PAGE TITLE
                ================================================= */}

                <section className="mb-8">

                    <div className="mb-4 flex items-center gap-3">

                        <span className="h-px w-10 bg-[#caa66a]" />

                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                            Booking Details
                        </span>

                    </div>

                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">

                        <div>

                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                {service?.serviceName ||
                                    "Home Service"}
                            </h2>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                                View the complete details
                                of your HomeMate service
                                booking.
                            </p>

                        </div>

                        <span
                            className={`w-fit border px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${statusClasses}`}
                        >
                            {getStatusLabel(
                                booking.status
                            )}
                        </span>

                    </div>

                </section>

                {/* =================================================
                    MAIN GRID
                ================================================= */}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">

                    {/* =================================================
                        LEFT COLUMN
                    ================================================= */}

                    <div className="space-y-6">

                        {/* SERVICE OVERVIEW */}

                        <section className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-6 py-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Service
                                </p>

                                <h3 className="mt-1 text-lg font-bold">
                                    Service Overview
                                </h3>

                            </div>

                            <div className="p-6">

                                <div className="flex items-start gap-4">

                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-blue-200 bg-blue-50 text-2xl">
                                        🔧
                                    </div>

                                    <div className="min-w-0">

                                        <h4 className="text-xl font-bold text-slate-950">
                                            {service?.serviceName ||
                                                "Home Service"}
                                        </h4>

                                        <p className="mt-2 text-sm leading-6 text-slate-500">
                                            {service?.description ||
                                                "Professional home service booked through HomeMate."}
                                        </p>

                                    </div>

                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">

                                    <div className="border border-slate-100 bg-slate-50 p-4">

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            Service Price
                                        </p>

                                        <p className="mt-2 text-xl font-bold text-slate-950">
                                            ₹
                                            {Number(
                                                service?.price ||
                                                    0
                                            ).toLocaleString(
                                                "en-IN"
                                            )}
                                        </p>

                                    </div>

                                    <div className="border border-slate-100 bg-slate-50 p-4">

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            Duration
                                        </p>

                                        <p className="mt-2 text-xl font-bold text-slate-950">
                                            {service?.duration ||
                                                0}{" "}
                                            minutes
                                        </p>

                                    </div>

                                </div>

                            </div>

                        </section>

                        {/* BOOKING INFORMATION */}

                        <section className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-6 py-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Schedule
                                </p>

                                <h3 className="mt-1 text-lg font-bold">
                                    Booking Information
                                </h3>

                            </div>

                            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">

                                <div className="border-b border-slate-100 p-6 sm:border-r">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        Service Date
                                    </p>

                                    <p className="mt-2 text-sm font-bold text-slate-950">
                                        {formatDate(
                                            booking.bookingDate
                                        )}
                                    </p>

                                </div>

                                <div className="border-b border-slate-100 p-6">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        Service Time
                                    </p>

                                    <p className="mt-2 text-sm font-bold text-slate-950">
                                        {formatTime(
                                            booking.bookingTime
                                        )}
                                    </p>

                                </div>

                                <div className="border-b border-slate-100 p-6 sm:border-r">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        Booking Status
                                    </p>

                                    <span
                                        className={`mt-2 inline-flex border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${statusClasses}`}
                                    >
                                        {getStatusLabel(
                                            booking.status
                                        )}
                                    </span>

                                </div>

                                <div className="border-b border-slate-100 p-6">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        Booking Reference
                                    </p>

                                    <p className="mt-2 break-all text-xs font-semibold text-slate-950">
                                        {booking.$id}
                                    </p>

                                </div>

                            </div>

                        </section>

                        {/* NOTES */}

                        <section className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-6 py-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Customer Notes
                                </p>

                                <h3 className="mt-1 text-lg font-bold">
                                    Booking Notes
                                </h3>

                            </div>

                            <div className="p-6">

                                <div className="border border-slate-100 bg-slate-50 p-5">

                                    <p className="text-sm leading-6 text-slate-600">
                                        {booking.notes ||
                                            "No additional notes were provided for this booking."}
                                    </p>

                                </div>

                            </div>

                        </section>

                    </div>

                    {/* =================================================
                        RIGHT COLUMN
                    ================================================= */}

                    <div className="space-y-6">

                        {/* PROFESSIONAL */}

                        <section className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-6 py-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Assigned Professional
                                </p>

                                <h3 className="mt-1 text-lg font-bold">
                                    Service Professional
                                </h3>

                            </div>

                            <div className="p-6">

                                <div className="flex items-center gap-4">

                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-blue-50 text-xl font-bold text-blue-600">
                                        {professional?.fullName
                                            ?.charAt(
                                                0
                                            )
                                            ?.toUpperCase() ||
                                            "P"}
                                    </div>

                                    <div className="min-w-0">

                                        <h4 className="truncate text-base font-bold text-slate-950">
                                            {professional?.fullName ||
                                                "Assigned Professional"}
                                        </h4>

                                        <p className="mt-1 text-xs text-slate-400">
                                            HomeMate Professional
                                        </p>

                                    </div>

                                </div>

                                <div className="mt-6 border-t border-slate-100 pt-5">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        Contact
                                    </p>

                                    <p className="mt-2 text-sm font-semibold text-slate-900">
                                        {professional?.phone ||
                                            "Contact information not available"}
                                    </p>

                                </div>

                            </div>

                        </section>

                        {/* PROPERTY */}

                        <section className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-6 py-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Service Location
                                </p>

                                <h3 className="mt-1 text-lg font-bold">
                                    Property
                                </h3>

                            </div>

                            <div className="p-6">

                                <div className="flex items-start gap-4">

                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-emerald-200 bg-emerald-50 text-xl">
                                        🏠
                                    </div>

                                    <div>

                                        <h4 className="text-base font-bold text-slate-950">
                                            {property?.propertyName ||
                                                "Property"}
                                        </h4>

                                        {property?.propertyType && (
                                            <p className="mt-1 text-xs text-slate-400">
                                                {
                                                    property.propertyType
                                                }
                                            </p>
                                        )}

                                    </div>

                                </div>

                                <div className="mt-5 border-t border-slate-100 pt-5">

                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        Address
                                    </p>

                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        {property?.address ||
                                            "Address not available"}
                                    </p>

                                </div>

                            </div>

                        </section>

                        {/* STATUS MESSAGE */}

                        <section
                            className={`border p-6 ${
                                booking.status ===
                                "Completed"
                                    ? "border-emerald-200 bg-emerald-50"
                                    : booking.status ===
                                      "Cancelled"
                                    ? "border-red-200 bg-red-50"
                                    : "border-blue-200 bg-blue-50"
                            }`}
                        >

                            <div className="flex items-start gap-4">

                                <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center ${
                                        booking.status ===
                                        "Completed"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : booking.status ===
                                              "Cancelled"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-blue-100 text-blue-700"
                                    }`}
                                >
                                    {booking.status ===
                                    "Completed"
                                        ? "✓"
                                        : booking.status ===
                                          "Cancelled"
                                        ? "!"
                                        : "●"}
                                </div>

                                <div>

                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                        Booking Status
                                    </p>

                                    <p className="mt-2 text-sm font-bold text-slate-950">
                                        {getStatusLabel(
                                            booking.status
                                        )}
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                        {statusMessage}
                                    </p>

                                </div>

                            </div>

                        </section>

                        {/* ACTIONS */}

                        <section className="border border-slate-200 bg-white p-6">

                            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                Quick Actions
                            </p>

                            <div className="mt-4 space-y-2">

                                <Link
                                    href="/dashboard/bookings"
                                    className="block w-full bg-slate-950 px-5 py-3.5 text-center text-[10px] font-bold text-white transition hover:bg-slate-800"
                                >
                                    ← View All Bookings
                                </Link>

                                <Link
                                    href="/dashboard/bookings/new"
                                    className="block w-full border border-slate-200 px-5 py-3.5 text-center text-[10px] font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-50"
                                >
                                    + Book Another Service
                                </Link>

                                <Link
                                    href="/dashboard"
                                    className="block w-full border border-slate-200 px-5 py-3.5 text-center text-[10px] font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-50"
                                >
                                    ← Back to Dashboard
                                </Link>

                            </div>

                        </section>

                    </div>

                </div>

                {/* =================================================
                    FOOTER REFERENCE
                ================================================= */}

                <section className="mt-6 border border-slate-200 bg-white px-6 py-5">

                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                        <div>

                            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                HomeMate Booking
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Keep this booking reference
                                for future support or
                                service-related communication.
                            </p>

                        </div>

                        <p className="break-all text-[10px] font-bold text-slate-400">
                            {booking.$id}
                        </p>

                    </div>

                </section>

            </div>

        </main>
    );
}