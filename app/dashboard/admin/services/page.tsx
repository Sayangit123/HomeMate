"use client";

import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";

import {
    getAllServices,
    deleteService,
} from "@/lib/appwrite/service";

import {
    useAdminServicesStore,
} from "@/lib/stores/admin-services-store";

import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";

interface Service {
    $id: string;
    userId: string;
    serviceName: string;
    description?: string | null;
    duration: number;
    price: number;
    availableDays: string | string[];
    availableSlots: string | string[];
    $createdAt?: string;
    $updatedAt?: string;
}

const categories = [
    "All",
    "AC Service",
    "Plumbing",
    "Electrical",
    "Cleaning",
    "Painting",
    "Carpentry",
    "Appliance Repair",
    "Other",
];

const getCategory = (
    serviceName: string
) => {
    const name =
        serviceName.toLowerCase();

    if (
        name.includes("ac") ||
        name.includes("air conditioner")
    ) {
        return "AC Service";
    }

    if (
        name.includes("plumb") ||
        name.includes("pipe") ||
        name.includes("tap") ||
        name.includes("leak")
    ) {
        return "Plumbing";
    }

    if (
        name.includes("electric") ||
        name.includes("wiring") ||
        name.includes("fan") ||
        name.includes("light")
    ) {
        return "Electrical";
    }

    if (
        name.includes("clean") ||
        name.includes("deep clean") ||
        name.includes("house clean")
    ) {
        return "Cleaning";
    }

    if (
        name.includes("paint") ||
        name.includes("wall")
    ) {
        return "Painting";
    }

    if (
        name.includes("carpent") ||
        name.includes("furniture") ||
        name.includes("wood")
    ) {
        return "Carpentry";
    }

    if (
        name.includes("repair") ||
        name.includes("washing machine") ||
        name.includes("refrigerator") ||
        name.includes("fridge") ||
        name.includes("microwave")
    ) {
        return "Appliance Repair";
    }

    return "Other";
};

const parseArray = (
    value:
        | string
        | string[]
        | undefined
): string[] => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    try {
        const parsed =
            JSON.parse(value);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        return [value];
    } catch {
        return value
            .split(",")
            .map(
                (item) =>
                    item.trim()
            )
            .filter(Boolean);
    }
};

export default function AdminServicesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

    /* ============================================================
        ZUSTAND
    ============================================================ */

    const {
        search,
        categoryFilter,
        setSearch,
        setCategoryFilter,
    } = useAdminServicesStore();

    /* ============================================================
        LOAD SERVICES - TANSTACK QUERY
    ============================================================ */

    const servicesQuery = useQuery({
        queryKey: [
            "admin",
            "services",
        ],

        queryFn: async () => {
            try {
                const response =
                    await getAllServices();

                return (
                    (response.documents ||
                        []) as unknown as Service[]
                );
            } catch (error) {
                console.error(
                    "Failed to load services:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Unable to Load Services",
                    text: "Something went wrong while loading services.",
                    confirmButtonColor:
                        "#0f172a",
                });

                throw error;
            }
        },
    });

    const services =
        servicesQuery.data || [];

    /* ============================================================
        DELETE SERVICE - TANSTACK MUTATION
    ============================================================ */

    const deleteMutation =
        useMutation({
            mutationFn: async (
                serviceId: string
            ) => {
                await deleteService(
                    serviceId
                );
            },

            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: [
                        "admin",
                        "services",
                    ],
                });
            },
        });

    /* ============================================================
        FILTER SERVICES
    ============================================================ */

    const filteredServices =
        useMemo(() => {
            return services.filter(
                (service) => {
                    const category =
                        getCategory(
                            service.serviceName
                        );

                    const searchText =
                        search
                            .toLowerCase()
                            .trim();

                    const matchesSearch =
                        !searchText ||
                        service.serviceName
                            ?.toLowerCase()
                            .includes(
                                searchText
                            ) ||
                        service.description
                            ?.toLowerCase()
                            .includes(
                                searchText
                            ) ||
                        service.userId
                            ?.toLowerCase()
                            .includes(
                                searchText
                            );

                    const matchesCategory =
                        categoryFilter ===
                            "All" ||
                        category ===
                            categoryFilter;

                    return (
                        matchesSearch &&
                        matchesCategory
                    );
                }
            );
        }, [
            services,
            search,
            categoryFilter,
        ]);

    /* ============================================================
        VIEW DETAILS
    ============================================================ */

    const handleViewDetails = (
        service: Service
    ) => {
        const days =
            parseArray(
                service.availableDays
            );

        const slots =
            parseArray(
                service.availableSlots
            );

        Swal.fire({
            title:
                service.serviceName,

            html: `
                <div style="text-align:left;line-height:1.8">

                    <p>
                        <strong>Category:</strong>
                        ${getCategory(
                            service.serviceName
                        )}
                    </p>

                    <p>
                        <strong>Professional ID:</strong>
                        ${service.userId}
                    </p>

                    <p>
                        <strong>Description:</strong>
                        ${
                            service.description ||
                            "No description provided"
                        }
                    </p>

                    <p>
                        <strong>Duration:</strong>
                        ${service.duration} minutes
                    </p>

                    <p>
                        <strong>Price:</strong>
                        ₹${service.price}
                    </p>

                    <p>
                        <strong>Available Days:</strong>
                        ${
                            days.length
                                ? days.join(
                                      ", "
                                  )
                                : "Not specified"
                        }
                    </p>

                    <p>
                        <strong>Available Slots:</strong>
                        ${
                            slots.length
                                ? slots.join(
                                      ", "
                                  )
                                : "Not specified"
                        }
                    </p>

                    <p>
                        <strong>Created:</strong>
                        ${
                            service.$createdAt
                                ? new Date(
                                      service.$createdAt
                                  ).toLocaleString()
                                : "N/A"
                        }
                    </p>

                </div>
            `,

            confirmButtonText:
                "Close",

            confirmButtonColor:
                "#0f172a",
        });
    };

    /* ============================================================
        DELETE SERVICE
    ============================================================ */

    const handleDelete = async (
        service: Service
    ) => {
        const result =
            await Swal.fire({
                title:
                    "Delete Service?",

                text: `Are you sure you want to delete "${service.serviceName}"?`,

                icon: "warning",

                showCancelButton:
                    true,

                confirmButtonText:
                    "Yes, Delete",

                cancelButtonText:
                    "Cancel",

                confirmButtonColor:
                    "#dc2626",

                cancelButtonColor:
                    "#64748b",

                reverseButtons:
                    true,
            });

        if (!result.isConfirmed) {
            return;
        }

        try {
            await deleteMutation.mutateAsync(
                service.$id
            );

            await Swal.fire({
                icon: "success",

                title:
                    "Service Deleted",

                text: "The service has been successfully deleted.",

                confirmButtonColor:
                    "#0f172a",
            });
        } catch (error) {
            console.error(
                "Delete service error:",
                error
            );

            await Swal.fire({
                icon: "error",

                title:
                    "Delete Failed",

                text: "Unable to delete this service.",

                confirmButtonColor:
                    "#0f172a",
            });
        }
    };

    /* ============================================================
        STATISTICS
    ============================================================ */

    const totalServices =
        services.length;

    const totalValue =
        services.reduce(
            (total, service) =>
                total +
                Number(
                    service.price || 0
                ),
            0
        );

    const categoriesUsed =
        new Set(
            services.map(
                (service) =>
                    getCategory(
                        service.serviceName
                    )
            )
        ).size;

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

    /* ============================================================
        RENDER
    ============================================================ */

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
                    <Link href="/dashboard/admin/services" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md"><span>🔧</span><span>Services</span></Link>
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
                    <Link href="/dashboard/admin/services" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"><span>🔧</span><span>Services</span></Link>
                    <Link href="/dashboard/admin/professionals" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🧰</span><span>Professionals</span></Link>
                    <Link href="/dashboard/admin/businesses" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🏢</span><span>Businesses</span></Link>
                    <Link href="/dashboard/admin/bookings" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>📅</span><span>Bookings</span></Link>
                    <Link href="/dashboard/admin/orders" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>📦</span><span>Orders</span></Link>
                    <Link href="/dashboard/admin/marketplace" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🛒</span><span>Marketplace</span></Link>
                    <Link href="/dashboard/admin/messages" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>💬</span><span>Messages</span></Link>
                    <Link href="/dashboard/admin/notifications" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>🔔</span><span>Notifications</span></Link>
                    <Link href="/dashboard/admin/reports" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"><span>📊</span><span>Reports</span></Link>
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
                        Service Management
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
                            <p className="text-[10px] font-medium text-slate-400">Service Management</p>
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
                {/* Breadcrumb & Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                        <Link href="/dashboard/admin" className="flex items-center gap-1 hover:text-slate-700">
                            <span>🏠</span>
                            <span>Dashboard</span>
                        </Link>
                        <span>/</span>
                        <span className="text-blue-600">Services</span>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            Swal.fire({
                                icon: "info",
                                title: "Add Service",
                                text: "Services are currently created by professionals. Admin can manage existing services from this panel.",
                                confirmButtonColor: "#0f172a",
                            })
                        }
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
                    >
                        <span>+</span>
                        <span>Add Service</span>
                    </button>
                </div>

                {/* Hero Banner Card */}
                <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-100/40 p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="max-w-xl">
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
                                ADMINISTRATION CONSOLE
                            </span>
                            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                                Service Management
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Manage HomeMate professional services and service details.
                            </p>
                        </div>

                        <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                                🔧
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900">Catalog Oversight</p>
                                <p className="text-[11px] text-slate-500">Supervise platform service listings.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3 Top Metric Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">🔧</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Services</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalServices}</p>
                            <p className="text-[10px] text-slate-400">Active catalog items</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">🏷️</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Service Categories</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{categoriesUsed}</p>
                            <p className="text-[10px] text-purple-600 font-medium">Unique categories</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">₹</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Listed Value</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">₹{totalValue.toLocaleString("en-IN")}</p>
                            <p className="text-[10px] text-emerald-600 font-medium">Combined pricing</p>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm items-center">
                    <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Search Services</label>
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by name, description or professional ID..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                        <select
                            value={categoryFilter}
                            onChange={(event) => setCategoryFilter(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition shadow-sm"
                        >
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Services Table */}
                <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-900">All Services</h3>
                            <p className="text-xs text-slate-500">Manage catalog and service details.</p>
                        </div>
                        <span className="text-xs font-bold text-slate-400">Showing {filteredServices.length} of {services.length} services</span>
                    </div>

                    {servicesQuery.isLoading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                                <p className="text-xs font-bold text-slate-400">Loading services...</p>
                            </div>
                        </div>
                    ) : filteredServices.length === 0 ? (
                        <div className="p-16 text-center">
                            <span className="text-4xl">🔧</span>
                            <h3 className="text-base font-bold text-slate-900 mt-3">No Services Found</h3>
                            <p className="text-xs text-slate-400 mt-1">No services match your current search or category filter.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">Service</th>
                                        <th className="p-4">Category</th>
                                        <th className="p-4">Professional</th>
                                        <th className="p-4">Duration</th>
                                        <th className="p-4">Price</th>
                                        <th className="p-4">Availability</th>
                                        <th className="p-4 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredServices.map((service) => {
                                        const days = parseArray(service.availableDays);
                                        const slots = parseArray(service.availableSlots);

                                        return (
                                            <tr key={service.$id} className="hover:bg-slate-50/60 transition">
                                                <td className="p-4 pl-6">
                                                    <p className="font-bold text-slate-900">{service.serviceName}</p>
                                                    <p className="mt-0.5 max-w-xs truncate text-[11px] text-slate-400">
                                                        {service.description || "No description"}
                                                    </p>
                                                </td>
                                                <td className="p-4">
                                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-600 border border-blue-200">
                                                        {getCategory(service.serviceName)}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-[11px] text-slate-500">
                                                    {service.userId}
                                                </td>
                                                <td className="p-4 font-semibold text-slate-700">
                                                    {service.duration} min
                                                </td>
                                                <td className="p-4 font-black text-slate-900">
                                                    ₹{Number(service.price || 0).toLocaleString("en-IN")}
                                                </td>
                                                <td className="p-4 text-slate-600 text-[11px]">
                                                    <p>{days.length} days</p>
                                                    <p className="text-slate-400">{slots.length} slots</p>
                                                </td>
                                                <td className="p-4 pr-6 text-right space-x-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(service)}
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/dashboard/admin/services/edit?id=${service.$id}`)}
                                                        className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm transition"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={deleteMutation.isPending}
                                                        onClick={() => handleDelete(service)}
                                                        className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm transition disabled:opacity-50"
                                                    >
                                                        {deleteMutation.isPending ? "..." : "Delete"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}