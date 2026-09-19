"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query } from "appwrite";

import client from "@/lib/appwrite/client";
import { getAllMembers } from "@/lib/appwrite/member";
import { getAllServices } from "@/lib/appwrite/service";

import {
    useAdminAnalyticsStore,
    AnalyticsPeriod,
} from "@/lib/stores/admin-analytics-store";

import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";
import Swal from "sweetalert2";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const BOOKINGS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_BOOKINGS_TABLE_ID ||
    "bookings";

/* ============================================================
   TYPES
============================================================ */

type Member = {
    $id: string;
    userId: string;
    fullName: string;
    role:
        | "customer"
        | "professional"
        | "business"
        | "admin";
    verificationStatus?: string;
    $createdAt?: string;
};

type Service = {
    $id: string;
    userId: string;
    serviceName: string;
    price?: number;
    duration?: number;
    $createdAt?: string;
};

type Booking = {
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
    $createdAt?: string;
};

type AnalyticsData = {
    members: Member[];
    services: Service[];
    bookings: Booking[];
};

/* ============================================================
   PERIOD OPTIONS
============================================================ */

const periodOptions: {
    value: AnalyticsPeriod;
    label: string;
}[] = [
    {
        value: "all",
        label: "All Time",
    },
    {
        value: "7",
        label: "Last 7 Days",
    },
    {
        value: "30",
        label: "Last 30 Days",
    },
    {
        value: "90",
        label: "Last 90 Days",
    },
];

/* ============================================================
   CLEAN DATE FORMATTER (Fixes 00:00:00 timestamp issue)
============================================================ */
const formatFriendlyDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const datePart = dateString.split("T")[0];
    const parsedDate = new Date(datePart);
    if (Number.isNaN(parsedDate.getTime())) return dateString;
    return parsedDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

/* ============================================================
   MAIN PAGE
============================================================ */

export default function AdminAnalyticsPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const period =
        useAdminAnalyticsStore(
            (state) => state.period
        );

    const setPeriod =
        useAdminAnalyticsStore(
            (state) => state.setPeriod
        );

    /* ============================================================
        LOAD CURRENT ADMIN FOR NAVBAR
    ============================================================ */
    const { data: adminData } = useQuery({
        queryKey: ["admin", "navbar-profile"],
        queryFn: async () => {
            try {
                const currentUser = await getCurrentUser();
                if (!currentUser) return null;
                const member = await getCurrentMember(currentUser.$id);
                return {
                    name: member?.fullName?.trim() || currentUser.name?.trim() || "Super Admin",
                    profileImage: member?.profileImage ? getProfileImageUrl(member.profileImage).toString() : null,
                };
            } catch {
                return { name: "Super Admin", profileImage: null };
            }
        },
        staleTime: 60 * 1000,
    });

    /* ========================================================
       FETCH DATA
    ======================================================== */

    const analyticsQuery =
        useQuery({
            queryKey: [
                "admin",
                "analytics",
            ],

            queryFn:
                async (): Promise<AnalyticsData> => {
                    const [
                        membersResponse,
                        servicesResponse,
                        bookingsResponse,
                    ] = await Promise.all([
                        getAllMembers(),

                        getAllServices(),

                        databases.listDocuments(
                            DATABASE_ID,
                            BOOKINGS_TABLE_ID,
                            [
                                Query.orderDesc(
                                    "$createdAt"
                                ),
                            ]
                        ),
                    ]);

                    return {
                        members:
                            (membersResponse.documents ||
                                []) as unknown as Member[],

                        services:
                            (servicesResponse.documents ||
                                []) as unknown as Service[],

                        bookings:
                            (bookingsResponse.documents ||
                                []) as unknown as Booking[],
                    };
                },

            retry: false,
        });

    const members =
        analyticsQuery.data
            ?.members || [];

    const services =
        analyticsQuery.data
            ?.services || [];

    const bookings =
        analyticsQuery.data
            ?.bookings || [];

    /* ========================================================
       PERIOD FILTER
    ======================================================== */

    const periodStartDate =
        useMemo(() => {
            if (period === "all") {
                return null;
            }

            const date =
                new Date();

            date.setDate(
                date.getDate() -
                    Number(period)
            );

            return date;
        }, [period]);

    const filteredMembers =
        useMemo(() => {
            if (!periodStartDate) {
                return members;
            }

            return members.filter(
                (member) =>
                    member.$createdAt &&
                    new Date(
                        member.$createdAt
                    ) >= periodStartDate
            );
        }, [
            members,
            periodStartDate,
        ]);

    const filteredServices =
        useMemo(() => {
            if (!periodStartDate) {
                return services;
            }

            return services.filter(
                (service) =>
                    service.$createdAt &&
                    new Date(
                        service.$createdAt
                    ) >= periodStartDate
            );
        }, [
            services,
            periodStartDate,
        ]);

    const filteredBookings =
        useMemo(() => {
            if (!periodStartDate) {
                return bookings;
            }

            return bookings.filter(
                (booking) =>
                    booking.$createdAt &&
                    new Date(
                        booking.$createdAt
                    ) >= periodStartDate
            );
        }, [
            bookings,
            periodStartDate,
        ]);

    /* ========================================================
       USER COUNTS
    ======================================================== */

    const customerCount =
        useMemo(
            () =>
                filteredMembers.filter(
                    (member) =>
                        member.role ===
                        "customer"
                ).length,
            [filteredMembers]
        );

    const professionalCount =
        useMemo(
            () =>
                filteredMembers.filter(
                    (member) =>
                        member.role ===
                        "professional"
                ).length,
            [filteredMembers]
        );

    const businessCount =
        useMemo(
            () =>
                filteredMembers.filter(
                    (member) =>
                        member.role ===
                        "business"
                ).length,
            [filteredMembers]
        );

    /* ========================================================
       BOOKING COUNTS
    ======================================================== */

    const requestedCount =
        useMemo(
            () =>
                filteredBookings.filter(
                    (booking) =>
                        booking.status ===
                        "Requested"
                ).length,
            [filteredBookings]
        );

    const acceptedCount =
        useMemo(
            () =>
                filteredBookings.filter(
                    (booking) =>
                        booking.status ===
                        "Accepted"
                ).length,
            [filteredBookings]
        );

    const inProgressCount =
        useMemo(
            () =>
                filteredBookings.filter(
                    (booking) =>
                        booking.status ===
                        "InProgress"
                ).length,
            [filteredBookings]
        );

    const completedCount =
        useMemo(
            () =>
                filteredBookings.filter(
                    (booking) =>
                        booking.status ===
                        "Completed"
                ).length,
            [filteredBookings]
        );

    const cancelledCount =
        useMemo(
            () =>
                filteredBookings.filter(
                    (booking) =>
                        booking.status ===
                        "Cancelled"
                ).length,
            [filteredBookings]
        );

    /* ========================================================
       SERVICE ANALYTICS
    ======================================================== */

    const averageServicePrice =
        useMemo(() => {
            if (
                filteredServices.length ===
                0
            ) {
                return 0;
            }

            const total =
                filteredServices.reduce(
                    (sum, service) =>
                        sum +
                        Number(
                            service.price || 0
                        ),
                    0
                );

            return (
                total /
                filteredServices.length
            );
        }, [filteredServices]);

    const highestPricedService =
        useMemo(() => {
            if (
                filteredServices.length ===
                0
            ) {
                return null;
            }

            return [
                ...filteredServices,
            ].sort(
                (a, b) =>
                    Number(
                        b.price || 0
                    ) -
                    Number(
                        a.price || 0
                    )
            )[0];
        }, [filteredServices]);

    /* ========================================================
       BOOKING COMPLETION RATE
    ======================================================== */

    const completionRate =
        useMemo(() => {
            if (
                filteredBookings.length ===
                0
            ) {
                return 0;
            }

            return Math.round(
                (completedCount /
                    filteredBookings.length) *
                    100
            );
        }, [
            filteredBookings,
            completedCount,
        ]);

    /* ========================================================
       USER DISTRIBUTION
    ======================================================== */

    const totalNonAdminUsers =
        customerCount +
        professionalCount +
        businessCount;

    const customerPercentage =
        totalNonAdminUsers > 0
            ? Math.round(
                  (customerCount /
                      totalNonAdminUsers) *
                      100
              )
            : 0;

    const professionalPercentage =
        totalNonAdminUsers > 0
            ? Math.round(
                  (professionalCount /
                      totalNonAdminUsers) *
                      100
              )
            : 0;

    const businessPercentage =
        totalNonAdminUsers > 0
            ? Math.round(
                  (businessCount /
                      totalNonAdminUsers) *
                      100
              )
            : 0;

    /* ========================================================
       RECENT BOOKINGS
    ======================================================== */

    const recentBookings =
        useMemo(
            () =>
                [...filteredBookings]
                    .sort(
                        (a, b) =>
                            new Date(
                                b.$createdAt ||
                                    0
                            ).getTime() -
                            new Date(
                                a.$createdAt ||
                                    0
                            ).getTime()
                    )
                    .slice(0, 6),
            [filteredBookings]
        );

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: "Logout from HomeMate?",
            text: "Your current administrator session will be ended.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Logout",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#94a3b8",
            reverseButtons: true,
        });

        if (!result.isConfirmed) return;

        try {
            await logoutAccount();
            window.location.replace("/login");
        } catch {
            window.location.replace("/login");
        }
    };

    /* ========================================================
       LOADING
    ======================================================== */

    if (
        analyticsQuery.isLoading
    ) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="text-sm font-semibold text-slate-500">Loading Platform Analytics...</p>
                </div>
            </div>
        );
    }

    /* ========================================================
       ERROR
    ======================================================== */

    if (
        analyticsQuery.isError
    ) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
                <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-xl">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-xl font-bold text-rose-500">
                        !
                    </div>
                    <h1 className="mt-4 text-xl font-bold text-slate-800">
                        Analytics Unavailable
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        We could not load the platform analytics.
                    </p>
                    <button
                        type="button"
                        onClick={() =>
                            analyticsQuery.refetch()
                        }
                        className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    /* ========================================================
       DASHBOARD
    ======================================================== */

    return (
        <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">
            {/* Mobile Sidebar Backdrop */}
            {mobileMenuOpen && (
                <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity" />
            )}

            {/* Mobile Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0b1a2e] text-white transition-transform duration-300 ease-in-out lg:hidden ${mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
                <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">🏠</div>
                        <div>
                            <span className="text-xl font-black tracking-tight text-white">Home<span className="text-blue-400">Mate</span></span>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Admin Portal</p>
                        </div>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-slate-300">✕</button>
                </div>
                <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4 text-xs font-bold">
                    <Link href="/dashboard/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"><span>🏠</span><span>Dashboard</span></Link>
                    <Link href="/dashboard/admin/users" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"><span>👥</span><span>Users</span></Link>
                    <Link href="/dashboard/admin/professionals" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"><span>🧰</span><span>Professionals</span></Link>
                    <Link href="/dashboard/admin/businesses" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"><span>🏢</span><span>Businesses</span></Link>
                    <Link href="/dashboard/admin/services" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"><span>🔧</span><span>Services</span></Link>
                    <Link href="/dashboard/admin/bookings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"><span>📅</span><span>Bookings</span></Link>
                </nav>
            </aside>

            {/* Desktop Fixed Navy Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-900/10 bg-[#0b1a2e] text-white lg:flex">
                <div className="flex h-20 items-center gap-3 px-6 border-b border-white/10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">🏠</div>
                    <div>
                        <span className="text-xl font-black tracking-tight text-white">Home<span className="text-blue-400">Mate</span></span>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Admin Portal</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5 text-xs font-bold [scrollbar-width:none]">
                    <Link href="/dashboard/admin" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🏠</span><span>Dashboard</span></Link>
                    <Link href="/dashboard/admin/users" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>👥</span><span>Users</span></Link>
                    <Link href="/dashboard/admin/properties" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🏘️</span><span>Properties</span></Link>
                    <Link href="/dashboard/admin/services" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🔧</span><span>Services</span></Link>
                    <Link href="/dashboard/admin/professionals" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🧰</span><span>Professionals</span></Link>
                    <Link href="/dashboard/admin/businesses" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🏢</span><span>Businesses</span></Link>
                    <Link href="/dashboard/admin/bookings" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>📅</span><span>Bookings</span></Link>
                    <Link href="/dashboard/admin/orders" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>📦</span><span>Orders</span></Link>
                    <Link href="/dashboard/admin/marketplace" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🛒</span><span>Marketplace</span></Link>
                    <Link href="/dashboard/admin/messages" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>💬</span><span>Messages</span></Link>
                    <Link href="/dashboard/admin/notifications" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🔔</span><span>Notifications</span></Link>
                    <Link href="/dashboard/admin/reports" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"><span>📊</span><span>Reports</span></Link>
                    <Link href="/dashboard/admin/settings" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>⚙️</span><span>Settings</span></Link>
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button onClick={handleLogout} className="flex w-full items-center gap-3.5 rounded-xl px-4 py-2.5 text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 text-xs font-bold">
                        <span>🚪</span><span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Top Navbar */}
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur lg:ml-64 gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => setMobileMenuOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 lg:hidden">☰</button>
                    <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                        Platform Analytics
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-blue-50">
                            {adminData?.profileImage ? (
                                <img src={adminData.profileImage} alt={adminData.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center font-bold text-xs text-blue-600 bg-blue-100">
                                    {adminData?.name?.charAt(0) || "A"}
                                </div>
                            )}
                        </div>
                        <div className="hidden text-left sm:block">
                            <p className="text-xs font-bold text-slate-900 leading-tight">{adminData?.name || "Super Admin"}</p>
                            <p className="text-[10px] font-medium text-slate-400">Analytics</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-600 hover:text-white active:scale-95 shadow-sm"
                    >
                        <span>🚪</span>
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                        <Link href="/dashboard/admin" className="flex items-center gap-1 hover:text-slate-700">
                            <span>🏠</span>
                            <span>Dashboard</span>
                        </Link>
                        <span>/</span>
                        <span className="text-blue-600">Analytics</span>
                    </div>

                    <div className="w-48">
                        <select
                            value={period}
                            onChange={(event) =>
                                setPeriod(
                                    event.target.value as AnalyticsPeriod
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                        >
                            {periodOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Hero Banner Card */}
                <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-100/40 p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="max-w-xl">
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
                                ADMINISTRATION CONSOLE
                            </span>
                            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                                Platform Analytics
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Monitor HomeMate platform activity, user distribution, services and booking performance.
                            </p>
                        </div>

                        <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                                📊
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900">Real-time Metrics</p>
                                <p className="text-[11px] text-slate-500">Comprehensive platform data evaluation.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4 Top Metric Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">👥</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Users</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalNonAdminUsers}</p>
                            <p className="text-[10px] text-slate-400">Registered platform users</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">🔧</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Services</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{filteredServices.length}</p>
                            <p className="text-[10px] text-slate-400">Professional services</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">📅</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Bookings</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{filteredBookings.length}</p>
                            <p className="text-[10px] text-slate-400">Platform bookings</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">✓</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Completion Rate</p>
                            <p className="text-2xl font-black text-emerald-600 mt-0.5">{completionRate}%</p>
                            <p className="text-[10px] text-slate-400">Completed bookings</p>
                        </div>
                    </div>
                </div>

                {/* User Distribution + Booking Status */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* User Distribution */}
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">User Analytics</p>
                            <h3 className="text-lg font-black text-slate-900 mt-0.5">User Distribution</h3>
                        </div>

                        <div className="space-y-5 text-xs">
                            <div>
                                <div className="mb-1.5 flex items-center justify-between font-bold text-slate-700">
                                    <span>Customers</span>
                                    <span>{customerCount} ({customerPercentage}%)</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${customerPercentage}%` }} />
                                </div>
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between font-bold text-slate-700">
                                    <span>Professionals</span>
                                    <span>{professionalCount} ({professionalPercentage}%)</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full bg-purple-600 rounded-full" style={{ width: `${professionalPercentage}%` }} />
                                </div>
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between font-bold text-slate-700">
                                    <span>Businesses</span>
                                    <span>{businessCount} ({businessPercentage}%)</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${businessPercentage}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booking Status */}
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Booking Analytics</p>
                            <h3 className="text-lg font-black text-slate-900 mt-0.5">Booking Status Breakdown</h3>
                        </div>

                        <div className="space-y-3.5 text-xs font-bold text-slate-700">
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                                <span>Requested</span>
                                <span className="text-amber-600">{requestedCount}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                                <span>Accepted</span>
                                <span className="text-blue-600">{acceptedCount}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                                <span>In Progress</span>
                                <span className="text-purple-600">{inProgressCount}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                                <span>Completed</span>
                                <span className="text-emerald-600">{completedCount}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                                <span>Cancelled</span>
                                <span className="text-rose-600">{cancelledCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Service Analytics Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service Count</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{filteredServices.length}</p>
                        <p className="mt-1 text-[11px] text-slate-400">Services in selected period</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Service Price</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">
                            ₹{averageServicePrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">Average listed price</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Highest Priced Service</p>
                        <p className="mt-2 text-base font-black text-slate-900 truncate">
                            {highestPricedService?.serviceName || "No services"}
                        </p>
                        <p className="mt-1 text-[11px] text-emerald-600 font-bold">
                            {highestPricedService ? `₹${Number(highestPricedService.price || 0).toLocaleString("en-IN")}` : "—"}
                        </p>
                    </div>
                </div>

                {/* Recent Bookings Table */}
                <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-900">Recent Bookings Activity</h3>
                            <p className="text-xs text-slate-500">Latest platform transactions and bookings.</p>
                        </div>
                        <Link href="/dashboard/admin/bookings" className="text-xs font-bold text-blue-600 hover:underline">
                            View All →
                        </Link>
                    </div>

                    {recentBookings.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-xs font-bold text-slate-400">No bookings available for this period.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">Booking ID</th>
                                        <th className="p-4">Customer</th>
                                        <th className="p-4">Professional</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4 pr-6">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {recentBookings.map((booking) => (
                                        <tr key={booking.$id} className="hover:bg-slate-50/60 transition">
                                            <td className="p-4 pl-6 font-mono text-[11px] text-slate-500">
                                                #{booking.$id.slice(0, 8)}
                                            </td>
                                            <td className="p-4 font-mono text-[11px] text-slate-600">
                                                {booking.customerId}
                                            </td>
                                            <td className="p-4 font-mono text-[11px] text-slate-600">
                                                {booking.professionalId}
                                            </td>
                                            <td className="p-4">
                                                <p className="font-bold text-slate-900">{formatFriendlyDate(booking.bookingDate)}</p>
                                                <p className="text-[10px] text-slate-400">{booking.bookingTime}</p>
                                            </td>
                                            <td className="p-4 pr-6">
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                                                    booking.status === "Completed"
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                        : booking.status === "Cancelled"
                                                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                        : booking.status === "Requested"
                                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                                }`}>
                                                    {booking.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}