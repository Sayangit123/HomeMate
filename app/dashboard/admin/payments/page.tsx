"use client";

import Link from "next/link";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";

import {
    getAllPayments,
    getPaymentById,
    updatePaymentStatus,
    type Payment,
    type PaymentStatus,
} from "@/lib/appwrite/payments";

import {
    getCurrentUser,
    logoutAccount,
} from "@/lib/appwrite/account";

import {
    getCurrentMember,
    type MemberRow,
} from "@/lib/appwrite/database";

import {
    getAllMembers,
} from "@/lib/appwrite/member";

import {
    getProfileImageUrl,
} from "@/lib/appwrite/storage";

import {
    useAdminPaymentsStore,
    type AdminPaymentStatus,
    type AdminPaymentMethod,
} from "@/lib/stores/admin-payments-store";


interface AppwriteUser {
    $id: string;
    name: string;
    email: string;
    $createdAt: string;
}


/* ==========================================================
   PAGE
========================================================== */

export default function AdminPaymentsPage() {

    /* ------------------------------------------------------
       Admin information
    ------------------------------------------------------ */

    const [
        currentUser,
        setCurrentUser,
    ] = useState<AppwriteUser | null>(null);

    const [
        currentMember,
        setCurrentMember,
    ] = useState<MemberRow | null>(null);

    const [
        adminProfileImage,
        setAdminProfileImage,
    ] = useState<string | null>(null);

    const [
        adminLoading,
        setAdminLoading,
    ] = useState(true);


    /* ------------------------------------------------------
       Mobile / Notification UI
    ------------------------------------------------------ */

    const [
        mobileMenuOpen,
        setMobileMenuOpen,
    ] = useState(false);

    const [
        showNotifications,
        setShowNotifications,
    ] = useState(false);

    const notificationRef =
        useRef<HTMLDivElement>(null);


    /* ------------------------------------------------------
       Payment details
    ------------------------------------------------------ */

    const [
        selectedPayment,
        setSelectedPayment,
    ] = useState<Payment | null>(null);

    const [
        isViewModalOpen,
        setIsViewModalOpen,
    ] = useState(false);

    const [
        updatingPaymentId,
        setUpdatingPaymentId,
    ] = useState<string | null>(null);


    /* ------------------------------------------------------
       Zustand store
    ------------------------------------------------------ */

    const {
        search,
        statusFilter,
        paymentMethodFilter,

        setSearch,
        setStatusFilter,
        setPaymentMethodFilter,

        resetFilters,
    } = useAdminPaymentsStore();


    /* ======================================================
       FETCH PAYMENTS
    ====================================================== */

    const {
        data: payments = [],
        isLoading: paymentsLoading,
        isError: paymentsError,
        error: paymentError,
        refetch,
    } = useQuery({
        queryKey: [
            "admin",
            "payments",
        ],

        queryFn: async (): Promise<Payment[]> => {

            const response =
                await getAllPayments();

            return (
                response.documents || []
            ) as unknown as Payment[];
        },

        staleTime: 15 * 1000,
    });


    /* ======================================================
       FETCH MEMBERS
       Used to display customer names when available.
    ====================================================== */

    const {
        data: members = [],
    } = useQuery({
        queryKey: [
            "admin",
            "payments-members",
        ],

        queryFn: async () => {

            const response =
                await getAllMembers();

            return response.documents || [];
        },

        staleTime: 30 * 1000,
    });


    /* ======================================================
       LOAD CURRENT ADMIN
    ====================================================== */

    useEffect(() => {

        let mounted = true;

        const loadAdmin = async () => {

            try {

                const user =
                    await getCurrentUser();

                if (!mounted) {
                    return;
                }

                setCurrentUser(
                    user as AppwriteUser
                );


                const member =
                    await getCurrentMember(
                        user.$id
                    );

                if (
                    member &&
                    mounted
                ) {

                    setCurrentMember(
                        member
                    );

                    if (
                        member.profileImage
                    ) {

                        try {

                            setAdminProfileImage(
                                getProfileImageUrl(
                                    member.profileImage
                                ).toString()
                            );

                        } catch {

                            setAdminProfileImage(
                                member.profileImage
                            );
                        }
                    }
                }

            } catch (error) {

                console.error(
                    "Admin load error:",
                    error
                );

            } finally {

                if (mounted) {
                    setAdminLoading(
                        false
                    );
                }
            }
        };


        loadAdmin();


        return () => {
            mounted = false;
        };

    }, []);


    /* ======================================================
       ADMIN NAME
    ====================================================== */

    const adminName =
        currentMember?.fullName?.trim() ||
        currentUser?.name?.trim() ||
        "Super Admin";


    /* ======================================================
       MEMBER MAP
    ====================================================== */

    const memberMap = useMemo(() => {

        const map =
            new Map<string, any>();

        members.forEach(
            (member: any) => {

                if (member?.userId) {

                    map.set(
                        member.userId,
                        member
                    );
                }

            }
        );

        return map;

    }, [members]);


    /* ======================================================
       GET CUSTOMER NAME
    ====================================================== */

    const getCustomerName = (
        customerId: string
    ) => {

        const member =
            memberMap.get(
                customerId
            );

        return (
            member?.fullName ||
            "Customer"
        );
    };


    /* ======================================================
       FILTER PAYMENTS
    ====================================================== */

    const filteredPayments =
        useMemo(() => {

            const searchValue =
                search
                    .trim()
                    .toLowerCase();

            return payments.filter(
                (payment) => {

                    const customerName =
                        getCustomerName(
                            payment.customerId
                        ).toLowerCase();

                    const matchesSearch =
                        !searchValue ||
                        payment.$id
                            .toLowerCase()
                            .includes(
                                searchValue
                            ) ||
                        payment.customerId
                            .toLowerCase()
                            .includes(
                                searchValue
                            ) ||
                        (
                            payment.bookingId ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                searchValue
                            ) ||
                        (
                            payment.orderId ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                searchValue
                            ) ||
                        payment.transcationId
                            .toLowerCase()
                            .includes(
                                searchValue
                            ) ||
                        customerName.includes(
                            searchValue
                        );


                    const matchesStatus =
                        statusFilter ===
                            "All" ||
                        payment.status
                            .toLowerCase() ===
                            statusFilter.toLowerCase();


                    const matchesMethod =
                        paymentMethodFilter ===
                            "All" ||
                        payment.paymentMethod
                            .toLowerCase() ===
                            paymentMethodFilter.toLowerCase();


                    return (
                        matchesSearch &&
                        matchesStatus &&
                        matchesMethod
                    );
                }
            );

        }, [
            payments,
            search,
            statusFilter,
            paymentMethodFilter,
            memberMap,
        ]);


    /* ======================================================
       PAYMENT STATISTICS
    ====================================================== */

    const totalPayments =
        payments.length;


    const completedPayments =
        useMemo(
            () =>
                payments.filter(
                    (payment) =>
                        payment.status
                            .toLowerCase() ===
                        "completed"
                ),
            [payments]
        );


    const pendingPayments =
        useMemo(
            () =>
                payments.filter(
                    (payment) =>
                        payment.status
                            .toLowerCase() ===
                        "pending"
                ),
            [payments]
        );


    const refundedPayments =
        useMemo(
            () =>
                payments.filter(
                    (payment) =>
                        payment.status
                            .toLowerCase()
                            .includes(
                                "refund"
                            )
                ),
            [payments]
        );


    const totalAmount =
        useMemo(
            () =>
                payments.reduce(
                    (
                        total,
                        payment
                    ) =>
                        total +
                        Number(
                            payment.amount ||
                                0
                        ),
                    0
                ),
            [payments]
        );


    const completedAmount =
        useMemo(
            () =>
                completedPayments.reduce(
                    (
                        total,
                        payment
                    ) =>
                        total +
                        Number(
                            payment.amount ||
                                0
                        ),
                    0
                ),
            [completedPayments]
        );


    const pendingAmount =
        useMemo(
            () =>
                pendingPayments.reduce(
                    (
                        total,
                        payment
                    ) =>
                        total +
                        Number(
                            payment.amount ||
                                0
                        ),
                    0
                ),
            [pendingPayments]
        );


    const refundedAmount =
        useMemo(
            () =>
                refundedPayments.reduce(
                    (
                        total,
                        payment
                    ) =>
                        total +
                        Number(
                            payment.refundAmount ||
                                0
                        ),
                    0
                ),
            [refundedPayments]
        );


    /* ======================================================
       FORMAT CURRENCY
    ====================================================== */

    const formatCurrency = (
        amount: number
    ) => {

        return new Intl.NumberFormat(
            "en-IN",
            {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
            }
        ).format(
            amount || 0
        );
    };


    /* ======================================================
       FORMAT DATE
    ====================================================== */

    const formatDate = (
        value?: string | null
    ) => {

        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return value;
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };


    /* ======================================================
       VIEW PAYMENT
    ====================================================== */

    const handleViewPayment = async (
        payment: Payment
    ) => {

        try {

            const latestPayment =
                await getPaymentById(
                    payment.$id
                );

            setSelectedPayment(
                latestPayment as unknown as Payment
            );

        } catch (error) {

            console.error(
                "Payment details error:",
                error
            );

            setSelectedPayment(
                payment
            );
        }

        setIsViewModalOpen(
            true
        );
    };


    /* ======================================================
       UPDATE PAYMENT STATUS
    ====================================================== */

    const handleStatusUpdate = async (
        payment: Payment,
        newStatus: PaymentStatus
    ) => {

        if (
            payment.status ===
            newStatus
        ) {
            return;
        }


        const result =
            await Swal.fire({

                title:
                    "Update Payment Status?",

                text:
                    `Change payment status to "${newStatus}"?`,

                icon:
                    "question",

                showCancelButton:
                    true,

                confirmButtonText:
                    "Yes, Update",

                cancelButtonText:
                    "Cancel",

                confirmButtonColor:
                    "#2563eb",

                reverseButtons:
                    true,
            });


        if (
            !result.isConfirmed
        ) {
            return;
        }


        try {

            setUpdatingPaymentId(
                payment.$id
            );


            const updated =
                await updatePaymentStatus(
                    payment.$id,
                    newStatus
                );


            const updatedPayment =
                updated as unknown as Payment;


            setSelectedPayment(
                updatedPayment
            );


            await refetch();


            Swal.fire({

                icon:
                    "success",

                title:
                    "Status Updated",

                text:
                    "Payment status has been updated successfully.",

                timer:
                    1500,

                showConfirmButton:
                    false,
            });


        } catch (error: any) {

            console.error(
                "Payment status update error:",
                error
            );


            Swal.fire(
                "Error",
                error?.message ||
                    "Could not update payment status.",
                "error"
            );

        } finally {

            setUpdatingPaymentId(
                null
            );
        }
    };


    /* ======================================================
       LOGOUT
    ====================================================== */

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: "Logout from HomeMate?",
            text: "Your current administrator session will be ended.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Logout",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#ef4444",
            reverseButtons: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            /* Clear server-side HomeMate session first. */
            try {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                });
            } catch (serverLogoutError) {
                console.error(
                    "Server logout error:",
                    serverLogoutError
                );
            }

            /* Clear Appwrite browser session. */
            try {
                await logoutAccount();
            } catch (appwriteLogoutError) {
                console.error(
                    "Appwrite logout error:",
                    appwriteLogoutError
                );
            }

            /* Clear common local authentication values. */
            const storageKeys = [
                "token",
                "accessToken",
                "authToken",
                "user",
                "userData",
                "role",
                "userRole",
            ];

            storageKeys.forEach((key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });

            /*
             * Clear client-accessible cookies.
             * HttpOnly cookies such as homemate-session are cleared
             * by /api/auth/logout above.
             */
            document.cookie
                .split(";")
                .forEach((cookie) => {
                    const name = cookie
                        .split("=")[0]
                        .trim();

                    if (name) {
                        document.cookie =
                            `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                    }
                });

            await Swal.fire({
                icon: "success",
                title: "Logged Out",
                text: "You have been successfully logged out.",
                timer: 1200,
                showConfirmButton: false,
            });

            /* Force proxy.ts to perform a fresh authentication check. */
            window.location.replace("/login");
        } catch (error) {
            console.error("Logout error:", error);
            window.location.replace("/login");
        }
    };

    /* ======================================================
       LOADING
    ====================================================== */

    if (
        paymentsLoading ||
        adminLoading
    ) {

        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">

                <div className="flex flex-col items-center gap-3">

                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />

                    <p className="text-sm font-semibold text-slate-500">
                        Loading Payment Management...
                    </p>

                </div>

            </main>
        );
    }


    /* ======================================================
       ERROR
    ====================================================== */

    if (
        paymentsError
    ) {

        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">

                <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl">
                        ⚠️
                    </div>

                    <h2 className="mt-4 text-lg font-black text-slate-900">
                        Unable to Load Payments
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        {
                            (paymentError as any)
                                ?.message ||
                            "Something went wrong while loading payment records."
                        }
                    </p>

                    <button
                        onClick={() =>
                            refetch()
                        }
                        className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                        Try Again
                    </button>

                </div>

            </main>
        );
    }


    /* ======================================================
       MAIN UI
    ====================================================== */

    return (
        <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">


            {/* ==================================================
                MOBILE OVERLAY
            ================================================== */}

            {mobileMenuOpen && (
                <div
                    onClick={() =>
                        setMobileMenuOpen(
                            false
                        )
                    }
                    className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden"
                />
            )}


            {/* ==================================================
                MOBILE SIDEBAR
            ================================================== */}

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/80 bg-white transition-transform duration-300 lg:hidden ${
                    mobileMenuOpen
                        ? "translate-x-0 shadow-2xl"
                        : "-translate-x-full"
                }`}
            >

                <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">

                    <span className="text-lg font-black tracking-tight text-slate-900">
                        Home
                        <span className="text-blue-600">
                            Mate
                        </span>
                    </span>

                    <button
                        onClick={() =>
                            setMobileMenuOpen(
                                false
                            )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
                    >
                        ✕
                    </button>

                </div>


                <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4 text-sm font-semibold">

                    <Link
                        href="/dashboard/admin"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🏠 Dashboard
                    </Link>

                    <Link
                        href="/dashboard/admin/users"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        👥 User Management
                    </Link>

                    <Link
                        href="/dashboard/admin/professionals"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🧰 Professionals
                    </Link>

                    <Link
                        href="/dashboard/admin/businesses"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🏢 Businesses
                    </Link>

                    <Link
                        href="/dashboard/admin/services"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🔧 Services
                    </Link>

                    <Link
                        href="/dashboard/admin/bookings"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        📅 Bookings
                    </Link>

                    <Link
                        href="/dashboard/admin/payments"
                        className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md"
                    >
                        💳 Payments
                    </Link>

                </nav>

            </aside>


            {/* ==================================================
                DESKTOP SIDEBAR
            ================================================== */}

            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">

                <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
                        🏠
                    </div>

                    <span className="text-xl font-black tracking-tight text-slate-900">
                        Home
                        <span className="text-blue-600">
                            Mate
                        </span>
                    </span>

                </div>


                <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5 text-sm font-semibold">

                    <Link
                        href="/dashboard/admin"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🏠 Dashboard
                    </Link>

                    <Link
                        href="/dashboard/admin/users"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        👥 User Management
                    </Link>

                    <Link
                        href="/dashboard/admin/professionals"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🧰 Professionals
                    </Link>

                    <Link
                        href="/dashboard/admin/businesses"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🏢 Businesses
                    </Link>

                    <Link
                        href="/dashboard/admin/services"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        🔧 Services
                    </Link>

                    <Link
                        href="/dashboard/admin/bookings"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50"
                    >
                        📅 Bookings
                    </Link>

                    <Link
                        href="/dashboard/admin/payments"
                        className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-500/25"
                    >
                        💳 Payments
                    </Link>

                </nav>

            </aside>


            {/* ==================================================
                HEADER
            ================================================== */}

            <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:ml-64">

                <div className="flex items-center gap-3">

                    <button
                        onClick={() =>
                            setMobileMenuOpen(
                                true
                            )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 lg:hidden"
                    >
                        ☰
                    </button>

                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-blue-600">
                        Payment Management Portal
                    </span>

                </div>


                <div className="flex items-center gap-4">

                    <div
                        ref={
                            notificationRef
                        }
                        className="relative hidden sm:block"
                    >

                        <button
                            onClick={() =>
                                setShowNotifications(
                                    !showNotifications
                                )
                            }
                            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm hover:bg-slate-50"
                        >
                            🔔

                            {payments.length >
                                0 && (
                                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600" />
                            )}

                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">

                                <p className="text-xs font-black text-slate-900">
                                    Payment Notifications
                                </p>

                                <p className="mt-2 text-xs text-slate-500">
                                    {pendingPayments.length > 0
                                        ? `${pendingPayments.length} payment${pendingPayments.length > 1 ? "s are" : " is"} currently pending.`
                                        : "No pending payment notifications."}
                                </p>

                            </div>
                        )}

                    </div>


                    <div className="flex items-center gap-3 border-l border-slate-200 pl-2">

                        <div className="h-10 w-10 overflow-hidden rounded-full border bg-blue-50">

                            {adminProfileImage ? (

                                <img
                                    src={
                                        adminProfileImage
                                    }
                                    alt={
                                        adminName
                                    }
                                    className="h-full w-full object-cover"
                                />

                            ) : (

                                <div className="flex h-full w-full items-center justify-center font-bold text-blue-600">
                                    A
                                </div>

                            )}

                        </div>


                        <div className="hidden text-left sm:block">

                            <p className="text-xs font-bold text-slate-900">
                                {adminName}
                            </p>

                            <p className="text-[10px] text-slate-400">
                                Super Admin
                            </p>

                        </div>

                    </div>


                    <button
                        onClick={
                            handleLogout
                        }
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-600 hover:text-white"
                    >
                        Logout
                    </button>

                </div>

            </header>


            {/* ==================================================
                MAIN
            ================================================== */}

            <main className="space-y-6 p-4 sm:p-6 lg:ml-64">

                <div className="mx-auto max-w-7xl space-y-6">


                    {/* ==================================================
                        TITLE
                    ================================================== */}

                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                        <div>

                            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                                Payment Management
                            </h1>

                            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                                Monitor and manage HomeMate payment transactions.
                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                refetch()
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            ↻ Refresh Payments
                        </button>

                    </div>


                    {/* ==================================================
                        METRIC CARDS
                    ================================================== */}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                        {/* Total */}

                        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">

                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600">
                                💳
                            </div>

                            <div>

                                <p className="text-xs font-bold text-slate-400">
                                    Total Payments
                                </p>

                                <p className="mt-0.5 text-2xl font-black text-slate-900">
                                    {totalPayments}
                                </p>

                                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                                    {formatCurrency(
                                        totalAmount
                                    )}
                                </p>

                            </div>

                        </div>


                        {/* Completed */}

                        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">

                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl text-emerald-600">
                                ✓
                            </div>

                            <div>

                                <p className="text-xs font-bold text-slate-400">
                                    Completed
                                </p>

                                <p className="mt-0.5 text-2xl font-black text-slate-900">
                                    {
                                        completedPayments.length
                                    }
                                </p>

                                <p className="mt-0.5 text-[10px] font-medium text-emerald-600">
                                    {formatCurrency(
                                        completedAmount
                                    )}
                                </p>

                            </div>

                        </div>


                        {/* Pending */}

                        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">

                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl text-amber-600">
                                ⏳
                            </div>

                            <div>

                                <p className="text-xs font-bold text-slate-400">
                                    Pending
                                </p>

                                <p className="mt-0.5 text-2xl font-black text-slate-900">
                                    {
                                        pendingPayments.length
                                    }
                                </p>

                                <p className="mt-0.5 text-[10px] font-medium text-amber-600">
                                    {formatCurrency(
                                        pendingAmount
                                    )}
                                </p>

                            </div>

                        </div>


                        {/* Refunded */}

                        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">

                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-xl text-purple-600">
                                ↩
                            </div>

                            <div>

                                <p className="text-xs font-bold text-slate-400">
                                    Refunded
                                </p>

                                <p className="mt-0.5 text-2xl font-black text-slate-900">
                                    {
                                        refundedPayments.length
                                    }
                                </p>

                                <p className="mt-0.5 text-[10px] font-medium text-purple-600">
                                    {formatCurrency(
                                        refundedAmount
                                    )}
                                </p>

                            </div>

                        </div>

                    </div>


                    {/* ==================================================
                        SEARCH / FILTER
                    ================================================== */}

                    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:grid-cols-4">

                        <div className="relative md:col-span-2">

                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs text-slate-400">
                                🔍
                            </span>

                            <input
                                type="text"
                                value={search}
                                onChange={(e) =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Search customer, transaction, order or booking..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                            />

                        </div>


                        <div>

                            <select
                                value={
                                    statusFilter
                                }
                                onChange={(e) =>
                                    setStatusFilter(
                                        e.target.value as AdminPaymentStatus
                                    )
                                }
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                            >

                                <option value="All">
                                    All Statuses
                                </option>

                                <option value="Pending">
                                    Pending
                                </option>

                                <option value="Completed">
                                    Completed
                                </option>

                                <option value="Failed">
                                    Failed
                                </option>

                                <option value="Refunded">
                                    Refunded
                                </option>

                                <option value="Partially Refunded">
                                    Partially Refunded
                                </option>

                            </select>

                        </div>


                        <div>

                            <select
                                value={
                                    paymentMethodFilter
                                }
                                onChange={(e) =>
                                    setPaymentMethodFilter(
                                        e.target.value as AdminPaymentMethod
                                    )
                                }
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                            >

                                <option value="All">
                                    All Methods
                                </option>

                                <option value="Card">
                                    Card
                                </option>

                                <option value="UPI">
                                    UPI
                                </option>

                                <option value="Net Banking">
                                    Net Banking
                                </option>

                                <option value="Wallet">
                                    Wallet
                                </option>

                                <option value="Cash">
                                    Cash
                                </option>

                            </select>

                        </div>

                    </div>


                    {/* ==================================================
                        ACTIVE FILTER / RESULT BAR
                    ================================================== */}

                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                        <div>

                            <h3 className="text-sm font-black text-slate-900">
                                Payment Transactions
                            </h3>

                            <p className="mt-0.5 text-xs text-slate-400">
                                Showing{" "}
                                {
                                    filteredPayments.length
                                }{" "}
                                of{" "}
                                {
                                    payments.length
                                }{" "}
                                payments
                            </p>

                        </div>


                        {(search ||
                            statusFilter !==
                                "All" ||
                            paymentMethodFilter !==
                                "All") && (

                            <button
                                onClick={
                                    resetFilters
                                }
                                className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 sm:self-auto"
                            >
                                Clear Filters
                            </button>

                        )}

                    </div>


                    {/* ==================================================
                        PAYMENT TABLE
                    ================================================== */}

                    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">

                        {filteredPayments.length ===
                        0 ? (

                            <div className="px-6 py-20 text-center">

                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-3xl">
                                    💳
                                </div>

                                <h3 className="mt-5 text-base font-black text-slate-900">
                                    No Payments Found
                                </h3>

                                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-400">
                                    {payments.length ===
                                    0
                                        ? "Payment transactions will appear here once customers complete payments through HomeMate."
                                        : "No payments match your current search or filter criteria."}
                                </p>

                                {payments.length >
                                    0 && (
                                    <button
                                        onClick={
                                            resetFilters
                                        }
                                        className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                                    >
                                        Clear Filters
                                    </button>
                                )}

                            </div>

                        ) : (

                            <div className="overflow-x-auto">

                                <table className="w-full min-w-[1100px] text-left text-xs">

                                    <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">

                                        <tr>

                                            <th className="p-4 pl-6">
                                                Customer
                                            </th>

                                            <th className="p-4">
                                                Amount
                                            </th>

                                            <th className="p-4">
                                                Payment Method
                                            </th>

                                            <th className="p-4">
                                                Transaction ID
                                            </th>

                                            <th className="p-4">
                                                Reference
                                            </th>

                                            <th className="p-4">
                                                Status
                                            </th>

                                            <th className="p-4">
                                                Payment Date
                                            </th>

                                            <th className="p-4 pr-6 text-right">
                                                Actions
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">

                                        {filteredPayments.map(
                                            (
                                                payment
                                            ) => (

                                                <tr
                                                    key={
                                                        payment.$id
                                                    }
                                                    className="transition hover:bg-slate-50/70"
                                                >

                                                    {/* CUSTOMER */}

                                                    <td className="p-4 pl-6">

                                                        <div>

                                                            <p className="font-bold text-slate-900">
                                                                {getCustomerName(
                                                                    payment.customerId
                                                                )}
                                                            </p>

                                                            <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                                                                {payment.customerId}
                                                            </p>

                                                        </div>

                                                    </td>


                                                    {/* AMOUNT */}

                                                    <td className="p-4">

                                                        <p className="font-black text-slate-900">
                                                            {formatCurrency(
                                                                Number(
                                                                    payment.amount
                                                                )
                                                            )}
                                                        </p>

                                                        {Number(
                                                            payment.refundAmount ||
                                                                0
                                                        ) >
                                                            0 && (

                                                            <p className="mt-0.5 text-[10px] text-purple-600">
                                                                Refund:{" "}
                                                                {formatCurrency(
                                                                    Number(
                                                                        payment.refundAmount
                                                                    )
                                                                )}
                                                            </p>

                                                        )}

                                                    </td>


                                                    {/* METHOD */}

                                                    <td className="p-4">

                                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                                                            {
                                                                payment.paymentMethod
                                                            }
                                                        </span>

                                                    </td>


                                                    {/* TRANSACTION */}

                                                    <td className="p-4">

                                                        <span
                                                            title={
                                                                payment.transcationId
                                                            }
                                                            className="block max-w-[150px] truncate font-mono text-[10px] text-slate-500"
                                                        >
                                                            {
                                                                payment.transcationId
                                                            }
                                                        </span>

                                                    </td>


                                                    {/* REFERENCE */}

                                                    <td className="p-4">

                                                        {payment.bookingId ? (

                                                            <div>

                                                                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
                                                                    Booking
                                                                </span>

                                                                <p className="mt-1 max-w-[110px] truncate font-mono text-[9px] text-slate-400">
                                                                    {
                                                                        payment.bookingId
                                                                    }
                                                                </p>

                                                            </div>

                                                        ) : payment.orderId ? (

                                                            <div>

                                                                <span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-600">
                                                                    Order
                                                                </span>

                                                                <p className="mt-1 max-w-[110px] truncate font-mono text-[9px] text-slate-400">
                                                                    {
                                                                        payment.orderId
                                                                    }
                                                                </p>

                                                            </div>

                                                        ) : (

                                                            <span className="text-slate-400">
                                                                —
                                                            </span>

                                                        )}

                                                    </td>


                                                    {/* STATUS */}

                                                    <td className="p-4">

                                                        <PaymentStatusBadge
                                                            status={
                                                                payment.status
                                                            }
                                                        />

                                                    </td>


                                                    {/* DATE */}

                                                    <td className="p-4 text-slate-500">

                                                        {
                                                            formatDate(
                                                                payment.paymentDate
                                                            )
                                                        }

                                                    </td>


                                                    {/* ACTIONS */}

                                                    <td className="p-4 pr-6 text-right">

                                                        <button
                                                            onClick={() =>
                                                                handleViewPayment(
                                                                    payment
                                                                )
                                                            }
                                                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                                        >
                                                            View
                                                        </button>

                                                    </td>

                                                </tr>

                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </div>

                </div>

            </main>


            {/* ==================================================
                PAYMENT DETAILS MODAL
            ================================================== */}

            {isViewModalOpen &&
                selectedPayment && (

                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">

                        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">

                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">

                                <div>

                                    <h3 className="text-base font-black text-slate-900">
                                        Payment Details
                                    </h3>

                                    <p className="mt-1 text-[10px] text-slate-400">
                                        Transaction information
                                    </p>

                                </div>

                                <button
                                    onClick={() =>
                                        setIsViewModalOpen(
                                            false
                                        )
                                    }
                                    className="text-slate-400 hover:text-slate-700"
                                >
                                    ✕
                                </button>

                            </div>


                            {/* PAYMENT SUMMARY */}

                            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">

                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                                    Payment Amount
                                </p>

                                <p className="mt-1 text-3xl font-black text-slate-900">
                                    {formatCurrency(
                                        Number(
                                            selectedPayment.amount
                                        )
                                    )}
                                </p>

                                <div className="mt-3">

                                    <PaymentStatusBadge
                                        status={
                                            selectedPayment.status
                                        }
                                    />

                                </div>

                            </div>


                            {/* DETAILS */}

                            <div className="mt-5 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">

                                <DetailRow
                                    label="Payment ID"
                                    value={
                                        selectedPayment.$id
                                    }
                                    mono
                                />

                                <DetailRow
                                    label="Customer"
                                    value={getCustomerName(
                                        selectedPayment.customerId
                                    )}
                                />

                                <DetailRow
                                    label="Customer ID"
                                    value={
                                        selectedPayment.customerId
                                    }
                                    mono
                                />

                                <DetailRow
                                    label="Payment Method"
                                    value={
                                        selectedPayment.paymentMethod
                                    }
                                />

                                <DetailRow
                                    label="Transaction ID"
                                    value={
                                        selectedPayment.transcationId
                                    }
                                    mono
                                />

                                <DetailRow
                                    label="Booking ID"
                                    value={
                                        selectedPayment.bookingId ||
                                        "Not linked to booking"
                                    }
                                    mono
                                />

                                <DetailRow
                                    label="Order ID"
                                    value={
                                        selectedPayment.orderId ||
                                        "Not linked to order"
                                    }
                                    mono
                                />

                                <DetailRow
                                    label="Payment Date"
                                    value={formatDate(
                                        selectedPayment.paymentDate
                                    )}
                                />

                                <DetailRow
                                    label="Refund Amount"
                                    value={formatCurrency(
                                        Number(
                                            selectedPayment.refundAmount ||
                                                0
                                        )
                                    )}
                                />

                                <DetailRow
                                    label="Created"
                                    value={formatDate(
                                        selectedPayment.$createdAt
                                    )}
                                />

                                <DetailRow
                                    label="Last Updated"
                                    value={formatDate(
                                        selectedPayment.$updatedAt
                                    )}
                                />

                            </div>


                            {/* STATUS UPDATE */}

                            <div className="mt-5">

                                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Update Payment Status
                                </label>

                                <select
                                    value={
                                        selectedPayment.status
                                    }
                                    disabled={
                                        updatingPaymentId ===
                                        selectedPayment.$id
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        handleStatusUpdate(
                                            selectedPayment,
                                            e.target.value as PaymentStatus
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                                >

                                    <option value="Pending">
                                        Pending
                                    </option>

                                    <option value="Completed">
                                        Completed
                                    </option>

                                    <option value="Failed">
                                        Failed
                                    </option>

                                    <option value="Refunded">
                                        Refunded
                                    </option>

                                    <option value="Partially Refunded">
                                        Partially Refunded
                                    </option>

                                </select>

                            </div>


                            <button
                                onClick={() =>
                                    setIsViewModalOpen(
                                        false
                                    )
                                }
                                className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md transition hover:bg-slate-800"
                            >
                                Close Window
                            </button>

                        </div>

                    </div>

                )}

        </div>
    );
}


/* ==========================================================
   PAYMENT STATUS BADGE
========================================================== */

function PaymentStatusBadge({
    status,
}: {
    status?: string | null;
}) {

    const normalized =
        (
            status ||
            "Pending"
        ).toLowerCase();


    let classes =
        "border-slate-200 bg-slate-50 text-slate-600";


    if (
        normalized ===
        "completed"
    ) {

        classes =
            "border-emerald-200 bg-emerald-50 text-emerald-600";

    } else if (
        normalized ===
        "pending"
    ) {

        classes =
            "border-amber-200 bg-amber-50 text-amber-600";

    } else if (
        normalized ===
        "failed"
    ) {

        classes =
            "border-rose-200 bg-rose-50 text-rose-600";

    } else if (
        normalized.includes(
            "refund"
        )
    ) {

        classes =
            "border-purple-200 bg-purple-50 text-purple-600";
    }


    return (
        <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${classes}`}
        >
            {status || "Pending"}
        </span>
    );
}


/* ==========================================================
   DETAIL ROW
========================================================== */

function DetailRow({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {

    return (
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 pb-2.5 last:border-0 last:pb-0">

            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {label}
            </span>

            <span
                title={value}
                className={`max-w-[65%] break-all text-right text-xs font-semibold text-slate-700 ${
                    mono
                        ? "font-mono text-[10px]"
                        : ""
                }`}
            >
                {value}
            </span>

        </div>
    );
}