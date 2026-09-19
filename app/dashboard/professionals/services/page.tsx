"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import {
    deleteService,
    getProfessionalServices,
} from "@/lib/appwrite/service";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/member";
import { useAuthStore } from "@/lib/stores/auth-store";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Service {
    $id: string;
    userId: string;
    serviceName: string;
    description?: string | null;
    duration: number;
    price: number;
    availableDays: string;
    availableSlots: string;
    status?: string; // Added optional status attribute for filtering
    $createdAt: string;
}

const parseJsonArray = (value: string): string[] => {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export default function ServicesPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [navbarSearch, setNavbarSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState<string>("All Services");

    // Zustand store sync for user profile
    const storedUser = useAuthStore((state) => state.user);
    const clearUser = useAuthStore((state) => state.clearUser);

    /* Current User query for navbar */
    const { data: currentUserData } = useQuery({
        queryKey: ["user", "services-current-user"],
        queryFn: getCurrentUser,
    });

    const currentUserId = currentUserData?.$id || storedUser?.userId || "";

    const { data: memberData } = useQuery({
        queryKey: ["user", "navbar-member-profile", currentUserId],
        queryFn: async () => {
            if (!currentUserId) return null;
            return await getCurrentMember(currentUserId);
        },
        enabled: !!currentUserId,
    });

    const { data: unreadNotificationsCount = 0 } = useQuery({
        queryKey: ["notifications", "unread-count", currentUserId],
        queryFn: async () => {
            if (!currentUserId) return 0;
            try {
                const res = await databases.listDocuments(
                    DATABASE_ID,
                    NOTIFICATIONS_TABLE_ID,
                    [AppwriteQuery.equal("userId", currentUserId), AppwriteQuery.equal("isRead", false)]
                );
                return res.total ?? res.documents.length;
            } catch {
                return 0;
            }
        },
        enabled: !!currentUserId,
        refetchInterval: 15000,
    });

    const fullName = memberData?.fullName?.trim() || currentUserData?.name?.trim() || storedUser?.fullName || "Sonu Bhoumik";
    const userEmail = currentUserData?.email || storedUser?.email || "sonu@gmail.com";
    const userProfileImage = memberData?.profileImage ? getProfileImageUrl(memberData.profileImage).toString() : storedUser?.profileImage;

    const initials = useMemo(() => {
        return (
            fullName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p: string) => p.charAt(0).toUpperCase())
                .join("") || "SB"
        );
    }, [fullName]);

    const loadServices = async () => {
        try {
            setLoading(true);
            const currentUser = await getCurrentUser();
            const response = await getProfessionalServices(currentUser.$id);
            setServices(response.documents as unknown as Service[]);
        } catch (error) {
            console.error("Load services error:", error);
            await Swal.fire({
                icon: "error",
                title: "Unable to Load Services",
                text: "Something went wrong while loading your services.",
                confirmButtonColor: "#0f172a",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServices();
    }, []);

    const handleDelete = async (service: Service) => {
        const result = await Swal.fire({
            icon: "warning",
            title: "Delete Service?",
            text: `Are you sure you want to delete "${service.serviceName}"? This action cannot be undone.`,
            showCancelButton: true,
            confirmButtonText: "Yes, Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            setDeletingId(service.$id);
            await deleteService(service.$id);
            setServices((currentServices) =>
                currentServices.filter(
                    (currentService) => currentService.$id !== service.$id
                )
            );

            await Swal.fire({
                icon: "success",
                title: "Service Deleted",
                text: "Your service has been successfully deleted.",
                confirmButtonColor: "#0f172a",
                timer: 1600,
                timerProgressBar: true,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Delete service error:", error);
            await Swal.fire({
                icon: "error",
                title: "Unable to Delete",
                text: "Something went wrong while deleting the service.",
                confirmButtonColor: "#0f172a",
            });
        } finally {
            setDeletingId(null);
        }
    };

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: "Logout from HomeMate?",
            text: "Your current session will be ended.",
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
            setLoggingOut(true);
            try {
                await fetch("/api/auth/logout", { method: "POST" });
            } catch (err) {
                console.warn("Server logout skip:", err);
            }
            await logoutAccount();
            clearUser();

            ["token", "accessToken", "authToken", "user", "userData", "role", "userRole"].forEach((key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });

            window.location.href = "/login";
        } catch (error) {
            console.error("Logout error:", error);
            clearUser();
            setLoggingOut(false);
            window.location.href = "/login";
        }
    };

    /* Fully functional filtering based on active filter pill */
    const filteredServices = useMemo(() => {
        if (activeFilter === "All Services") return services;
        return services.filter((service) => {
            const currentStatus = (service.status || "active").toLowerCase();
            return currentStatus === activeFilter.toLowerCase();
        });
    }, [services, activeFilter]);

    if (!mounted) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {/* Mobile Drawer Backdrop */}
            {mobileMenuOpen && (
                <div
                    onClick={() => setMobileMenuOpen(false)}
                    className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
                />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0b1a2e] text-white transition-transform duration-300 ease-in-out lg:hidden ${
                    mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                }`}
            >
                <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                            🏠
                        </div>
                        <div>
                            <span className="text-xl font-black tracking-tight text-white">
                                Home<span className="text-blue-400">Mate</span>
                            </span>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                HOME SERVICES PLATFORM
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-slate-300 hover:bg-white/10"
                    >
                        ✕
                    </button>
                </div>

                <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4 text-xs font-bold">
                    <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
                        <span>🏠</span><span>Dashboard</span>
                    </Link>
                    <Link href="/dashboard/professionals/services" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md">
                        <span>🛠️</span><span>My Services</span>
                    </Link>
                    <Link href="/dashboard/properties" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
                        <span>🏘️</span><span>My Properties</span>
                    </Link>
                    <Link href="/dashboard/maintenance" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
                        <span>🔧</span><span>Maintenance</span>
                    </Link>
                    <Link href="/dashboard/bookings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
                        <span>📅</span><span>My Bookings</span>
                    </Link>
                    <Link href="/dashboard/marketplace" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
                        <span>🛒</span><span>Marketplace</span>
                    </Link>
                </nav>
            </aside>

            {/* Desktop Fixed Navy Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-900/10 bg-[#0b1a2e] text-white lg:flex">
                <div className="flex h-20 items-center gap-3 px-6 border-b border-white/10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                        🏠
                    </div>
                    <div>
                        <span className="text-xl font-black tracking-tight text-white">
                            Home<span className="text-blue-400">Mate</span>
                        </span>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            HOME SERVICES PLATFORM
                        </p>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5 text-xs font-bold [scrollbar-width:none]">
                    <Link href="/dashboard" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>🏠</span><span>Dashboard</span>
                    </Link>
                    <Link href="/dashboard/properties" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>🏘️</span><span>My Properties</span>
                    </Link>
                    <Link href="/dashboard/maintenance" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>🔧</span><span>Maintenance</span>
                    </Link>
                    <Link href="/dashboard/bookings/new" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>🛠️</span><span>Book a Service</span>
                    </Link>
                    <Link href="/dashboard/bookings" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>📅</span><span>My Bookings</span>
                    </Link>
                    <Link href="/dashboard/marketplace" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>🛒</span><span>Marketplace</span>
                    </Link>
                    <Link href="/dashboard/professionals/services" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30">
                        <span>🛠️</span><span>My Services</span>
                    </Link>
                    <Link href="/dashboard/service-history" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>⏱️</span><span>Service History</span>
                    </Link>
                    <Link href="/dashboard/messages" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>💬</span><span>Messages</span>
                    </Link>
                    <Link href="/dashboard/notifications" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>🔔</span><span>Notifications</span>
                    </Link>

                    <div className="pt-4 border-t border-white/10 space-y-1">
                        <Link href="/dashboard/profile" className="flex items-center gap-3.5 rounded-xl px-4 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
                            <span>👤</span><span>My Profile</span>
                        </Link>
                        <Link href="/dashboard/settings" className="flex items-center gap-3.5 rounded-xl px-4 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
                            <span>⚙️</span><span>Settings</span>
                        </Link>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-2 text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                        >
                            <span>🚪</span><span>Logout</span>
                        </button>
                    </div>
                </nav>

                {/* Promo Card */}
                <div className="p-4">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#122844] to-[#0d1e33] p-4 border border-white/10 shadow-lg">
                        <div className="flex h-14 w-full items-center justify-center rounded-xl bg-blue-500/10 mb-2.5 text-2xl">
                            🏡
                        </div>
                        <h4 className="text-xs font-black text-white leading-tight">
                            Your Home<br />Our Priority
                        </h4>
                        <p className="mt-1 text-[10px] text-slate-400">
                            Trusted professionals for a better living.
                        </p>
                        <Link
                            href="/dashboard/bookings/new"
                            className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
                        >
                            <span>Book a Service</span>
                            <span>→</span>
                        </Link>
                    </div>
                </div>
            </aside>

            {/* Top Navbar */}
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur lg:ml-64 gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-xl">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="Open mobile menu"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 lg:hidden"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 text-sm">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={navbarSearch}
                            onChange={(e) => setNavbarSearch(e.target.value)}
                            placeholder="Search services, professionals, or more..."
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Link
                            href="/dashboard/notifications"
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:border-slate-300"
                        >
                            🔔
                        </Link>
                        {unreadNotificationsCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex min-h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-sm ring-2 ring-white animate-pulse">
                                {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-blue-50">
                            {userProfileImage ? (
                                <img src={userProfileImage} alt={fullName} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center font-black text-xs text-blue-600 bg-blue-100">
                                    {initials}
                                </div>
                            )}
                        </div>

                        <div className="hidden text-left sm:block">
                            <p className="text-xs font-bold text-slate-900 leading-tight">{fullName}</p>
                            <p className="text-[10px] font-medium text-slate-400">{userEmail}</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-600 hover:text-white active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <span>🚪</span>
                        <span className="hidden sm:inline">{loggingOut ? "Logging out..." : "Logout"}</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                        <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-700">
                            <span>🏠</span>
                            <span>Home</span>
                        </Link>
                        <span>/</span>
                        <span className="text-blue-600">My Services</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                        <span>←</span>
                        <span>Back to Dashboard</span>
                    </button>
                </div>

                {/* Hero Banner Card */}
                <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-100/40 p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="max-w-xl">
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
                                SERVICE MANAGEMENT
                            </span>
                            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                                My Services
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Manage the professional services you offer through HomeMate.
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex flex-col text-right">
                                <span className="text-xs font-black text-slate-900">Keep Your Services Up to Date</span>
                                <span className="text-[11px] text-slate-500">Quality Services Stronger Homes</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push("/dashboard/professionals/services/add")}
                                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
                            >
                                <span>+</span>
                                <span>Add New Service</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4 TOP METRIC CARDS */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
                            📦
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Services</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{services.length}</p>
                            <p className="text-[10px] text-slate-400">Published services</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-emerald-50/40 p-5 shadow-sm border-emerald-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
                            ✓
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-600">Active Services</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{services.length}</p>
                            <p className="text-[10px] text-emerald-500 font-medium">Currently available</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
                            📅
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Bookings</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">0</p>
                            <p className="text-[10px] text-slate-400">Service bookings</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">
                            ★
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Average Rating</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">—</p>
                            <p className="text-[10px] text-slate-400">No reviews yet</p>
                        </div>
                    </div>
                </div>

                {/* FILTER PILLS */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {["All Services", "Active", "Inactive", "Drafts"].map((pill) => (
                        <button
                            key={pill}
                            type="button"
                            onClick={() => setActiveFilter(pill)}
                            className={`rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-sm whitespace-nowrap ${
                                activeFilter === pill
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            {pill}
                        </button>
                    ))}
                </div>

                {/* MAIN BODY GRID WITH SIDEBAR */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* SERVICES LIST (8 Cols) */}
                    <div className="lg:col-span-8 space-y-6">
                        {loading ? (
                            <div className="rounded-3xl border bg-white p-16 text-center shadow-sm">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                                <p className="mt-3 text-xs font-bold text-slate-400">Loading Services...</p>
                            </div>
                        ) : filteredServices.length === 0 ? (
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl font-bold text-blue-600">
                                    +
                                </div>
                                <h3 className="mt-4 text-base font-black text-slate-900">No Services Found for "{activeFilter}"</h3>
                                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                    You have no services matching this status filter. Try switching to "All Services" or add a new service.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => router.push("/dashboard/professionals/services/add")}
                                    className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
                                >
                                    Publish New Service →
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {filteredServices.map((service) => {
                                    const days = parseJsonArray(service.availableDays);
                                    const slots = parseJsonArray(service.availableSlots);

                                    return (
                                        <article
                                            key={service.$id}
                                            className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-blue-300 transition"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-200 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                                                        Active
                                                    </span>
                                                    <div>
                                                        <h3 className="text-base font-black text-slate-900">{service.serviceName}</h3>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            Category: <span className="font-semibold text-slate-600">Home Maintenance</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right rounded-2xl bg-blue-50/60 px-4 py-2 border border-blue-100">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Price</p>
                                                    <p className="text-base font-black text-slate-900">₹{service.price}</p>
                                                </div>
                                            </div>

                                            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
                                                {service.description || "Professional home service with reliable support, genuine parts and on-time service."}
                                            </p>

                                            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Duration</p>
                                                    <p className="font-black text-slate-900 mt-0.5">{service.duration} minutes</p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Availability</p>
                                                    <p className="font-black text-slate-900 mt-0.5">{days.length} days active</p>
                                                </div>
                                                <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Time Slots</p>
                                                    <p className="font-black text-slate-900 mt-0.5">{slots.length} slots</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase self-center mr-1">Days:</span>
                                                {days.map((day) => (
                                                    <span key={day} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700">
                                                        {day}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(`/dashboard/professionals/services/${service.$id}/edit`)}
                                                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                                                >
                                                    ✏️ Edit Service
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(service)}
                                                    disabled={deletingId === service.$id}
                                                    className="flex-1 rounded-xl border border-rose-200 bg-rose-50/50 py-2.5 text-center text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-sm disabled:opacity-50"
                                                >
                                                    {deletingId === service.$id ? "Deleting..." : "🗑️ Delete Service"}
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDEBAR WIDGETS (4 Cols) */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Service Tips */}
                        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
                            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                                <span>💡</span>
                                <span>Service Tips</span>
                            </h3>
                            <ul className="space-y-3 text-xs text-slate-600 font-medium">
                                <li className="flex items-start gap-2.5">
                                    <span className="text-emerald-600 font-bold">✓</span>
                                    <span>Keep your service details updated regularly.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="text-emerald-600 font-bold">✓</span>
                                    <span>Set competitive and fair pricing.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="text-emerald-600 font-bold">✓</span>
                                    <span>Add clear descriptions and accurate durations.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="text-emerald-600 font-bold">✓</span>
                                    <span>Manage your weekly availability slots.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="text-emerald-600 font-bold">✓</span>
                                    <span>Respond to booking requests quickly.</span>
                                </li>
                            </ul>
                        </div>

                        {/* Need Help? Support Widget */}
                        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                                    🎧
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-900">Need Help?</h4>
                                    <p className="text-[11px] text-slate-500">We're here to assist you.</p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Have questions about managing your services? Contact HomeMate support anytime.
                            </p>
                            <button
                                type="button"
                                onClick={() => router.push("/dashboard/messages")}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-white hover:border-blue-300 transition shadow-sm"
                            >
                                Contact Support →
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-12 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/80 pt-6 text-xs text-slate-400 gap-3">
                    <p>HomeMate • Professional Service Management</p>
                    <p>Verified Professional Portal</p>
                </footer>
            </main>
        </div>
    );
}