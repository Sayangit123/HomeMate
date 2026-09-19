"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Swal from "sweetalert2";
import { Databases } from "appwrite";

import client from "@/lib/appwrite/client";
import { getAllMembers } from "@/lib/appwrite/member";
import { useAdminProfessionalsStore } from "@/lib/stores/admin-professionals-store";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const MEMBERS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID || "members";

interface Professional {
    $id: string;
    userId: string;
    fullName: string;
    phone?: string | null;
    role:
        | "customer"
        | "professional"
        | "business"
        | "admin";
    profileImage?: string | null;
    profileCompletion: number;
    verificationStatus: string;
    licenseDocument?: string | null;
    certificateDocument?: string | null;
    verificationSubmittedAt?: string | null;
    $createdAt?: string;
    $updatedAt?: string;
}

export default function AdminProfessionalsPage() {
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const {
        searchTerm,
        verificationFilter,
        setSearchTerm,
        setVerificationFilter,
    } = useAdminProfessionalsStore();

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
        LOAD PROFESSIONALS QUERY & LOCAL SYNC
    ============================================================ */
    const professionalsQuery = useQuery({
        queryKey: ["admin", "professionals-directory"],
        queryFn: async () => {
            const response = await getAllMembers();
            const allMembers = response.documents as unknown as Professional[];
            return allMembers.filter((member) => member.role === "professional");
        },
    });

    useEffect(() => {
        if (professionalsQuery.data) {
            setProfessionals(professionalsQuery.data);
        }
    }, [professionalsQuery.data]);

    /* ============================================================
        COUNTS
    ============================================================ */
    const totalProfessionals = professionals.length;

    const approvedCount = useMemo(
        () => professionals.filter((p) => p.verificationStatus === "Approved").length,
        [professionals]
    );

    const pendingCount = useMemo(
        () => professionals.filter((p) => p.verificationStatus === "Pending").length,
        [professionals]
    );

    const rejectedCount = useMemo(
        () => professionals.filter((p) => p.verificationStatus === "Rejected").length,
        [professionals]
    );

    /* ============================================================
        FILTER PROFESSIONALS
    ============================================================ */
    const filteredProfessionals = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();

        return professionals.filter((professional) => {
            const matchesSearch =
                !search ||
                professional.fullName.toLowerCase().includes(search) ||
                professional.userId.toLowerCase().includes(search) ||
                (professional.phone || "").toLowerCase().includes(search);

            const matchesVerification =
                verificationFilter === "all" ||
                professional.verificationStatus === verificationFilter;

            return matchesSearch && matchesVerification;
        });
    }, [professionals, searchTerm, verificationFilter]);

    /* ============================================================
        VERIFICATION BADGE & INSTANT STATUS UPDATE
    ============================================================ */
    const getVerificationBadgeClass = (status: string) => {
        switch (status) {
            case "Approved":
                return "bg-emerald-50 text-emerald-700 border border-emerald-200";
            case "Pending":
                return "bg-amber-50 text-amber-700 border border-amber-200";
            case "Rejected":
                return "bg-red-50 text-red-700 border border-red-200";
            default:
                return "bg-slate-100 text-slate-600 border border-slate-200";
        }
    };

    const handleStatusChange = async (professional: Professional, newStatus: string) => {
        if (professional.verificationStatus === newStatus) return;

        const confirmation = await Swal.fire({
            title: "Update Verification Status?",
            text: `Change ${professional.fullName}'s status to ${newStatus}?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Update",
            confirmButtonColor: "#0f172a",
        });

        if (!confirmation.isConfirmed) return;

        try {
            setUpdatingId(professional.$id);
            await databases.updateDocument(DATABASE_ID, MEMBERS_TABLE_ID, professional.$id, {
                verificationStatus: newStatus,
            });

            // Immediately update local state so table and cards refresh instantly without page reload
            setProfessionals((prev) =>
                prev.map((p) => (p.$id === professional.$id ? { ...p, verificationStatus: newStatus } : p))
            );

            Swal.fire({
                icon: "success",
                title: "Status Updated",
                text: `${professional.fullName} is now ${newStatus}.`,
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Status update error:", error);
            Swal.fire("Error", "Could not update verification status.", "error");
        } finally {
            setUpdatingId(null);
        }
    };

    /* ============================================================
        PROFILE COMPLETION & HELPERS
    ============================================================ */
    const getProfileCompletionClass = (completion: number) => {
        if (completion >= 80) return "text-emerald-700";
        if (completion >= 50) return "text-amber-700";
        return "text-red-700";
    };

    const formatDate = (date?: string) => {
        if (!date) return "—";
        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) return "—";
        return parsedDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const handleViewProfessional = async (professional: Professional) => {
        await Swal.fire({
            title: professional.fullName,
            html: `
                <div style="text-align:left;line-height:1.8">
                    <p><strong>User ID:</strong> ${professional.userId}</p>
                    <p><strong>Phone:</strong> ${professional.phone || "Not provided"}</p>
                    <p><strong>Role:</strong> Professional</p>
                    <p><strong>Profile Completion:</strong> ${professional.profileCompletion}%</p>
                    <p><strong>Verification:</strong> ${professional.verificationStatus}</p>
                    <p><strong>License Document:</strong> ${professional.licenseDocument ? "Submitted" : "Not submitted"}</p>
                    <p><strong>Certificate Document:</strong> ${professional.certificateDocument ? "Submitted" : "Not submitted"}</p>
                    <p><strong>Verification Submitted:</strong> ${professional.verificationSubmittedAt ? formatDate(professional.verificationSubmittedAt) : "Not submitted"}</p>
                    <p><strong>Created:</strong> ${formatDate(professional.$createdAt)}</p>
                </div>
            `,
            confirmButtonText: "Close",
            confirmButtonColor: "#0f172a",
        });
    };

    const handleEditProfessional = (professional: Professional) => {
        router.push(`/dashboard/admin/users/edit?id=${professional.$id}`);
    };

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
                    <Link href="/dashboard/admin/professionals" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md"><span>🧰</span><span>Professionals</span></Link>
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
                    <Link href="/dashboard/admin/professionals" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"><span>🧰</span><span>Professionals</span></Link>
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
                        Professional Management
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
                            <p className="text-[10px] font-medium text-slate-400">Professional Management</p>
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
                        <span className="text-blue-600">Professionals</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => professionalsQuery.refetch()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                        <span>↻</span>
                        <span>Refresh Professionals</span>
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
                                Professional Management
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Manage HomeMate service professionals, verification status and professional account information.
                            </p>
                        </div>

                        <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                                🛡️
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900">Verify Professionals</p>
                                <p className="text-[11px] text-slate-500">Ensure quality services and build customer trust.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4 Top Metric Cards (Updates instantly) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">👥</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Professionals</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalProfessionals}</p>
                            <p className="text-[10px] text-slate-400">Registered professionals</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">✓</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Approved</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{approvedCount}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">Verified professionals</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">⏳</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Pending</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{pendingCount}</p>
                            <p className="text-[10px] text-amber-600 font-bold">Awaiting verification</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 text-xl font-bold">✕</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Rejected</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{rejectedCount}</p>
                            <p className="text-[10px] text-rose-500 font-medium">Verification rejected</p>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm items-center">
                    <div className="relative sm:col-span-2">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search by name, phone or user ID..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition shadow-sm"
                        />
                    </div>

                    <div>
                        <select
                            value={verificationFilter}
                            onChange={(event) => setVerificationFilter(event.target.value as typeof verificationFilter)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition shadow-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                {/* Professional Table */}
                <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-900">HomeMate Professionals</h3>
                            <p className="text-xs text-slate-500">View and manage all registered service professionals.</p>
                        </div>
                        <span className="text-xs font-bold text-slate-400">Showing {filteredProfessionals.length} of {professionals.length} professionals</span>
                    </div>

                    {professionalsQuery.isLoading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                                <p className="text-xs font-bold text-slate-400">Loading professionals...</p>
                            </div>
                        </div>
                    ) : filteredProfessionals.length === 0 ? (
                        <div className="p-16 text-center">
                            <span className="text-4xl">🛠️</span>
                            <h3 className="text-base font-bold text-slate-900 mt-3">No Professionals Found</h3>
                            <p className="text-xs text-slate-400 mt-1">No professional accounts match your current search or filter.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">Professional</th>
                                        <th className="p-4">User ID</th>
                                        <th className="p-4">Phone</th>
                                        <th className="p-4">Profile</th>
                                        <th className="p-4">Verification</th>
                                        <th className="p-4">Documents</th>
                                        <th className="p-4">Created</th>
                                        <th className="p-4 pr-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredProfessionals.map((professional) => (
                                        <tr key={professional.$id} className="hover:bg-slate-50/60 transition">
                                            <td className="p-4 pl-6 flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white shadow-sm">
                                                    {professional.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{professional.fullName}</p>
                                                    <p className="text-[10px] text-slate-400">{professional.$id}</p>
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono text-[11px] text-slate-500">{professional.userId}</td>
                                            <td className="p-4 text-slate-600">{professional.phone || "Not provided"}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-xs font-bold ${getProfileCompletionClass(professional.profileCompletion)}`}>
                                                        {professional.profileCompletion}%
                                                    </span>
                                                    <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-600 rounded-full"
                                                            style={{
                                                                width: `${Math.min(Math.max(professional.profileCompletion, 0), 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <select
                                                    value={professional.verificationStatus}
                                                    disabled={updatingId === professional.$id}
                                                    onChange={(e) => handleStatusChange(professional, e.target.value)}
                                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase outline-none shadow-sm cursor-pointer ${getVerificationBadgeClass(professional.verificationStatus)}`}
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Approved">Approved</option>
                                                    <option value="Rejected">Rejected</option>
                                                </select>
                                            </td>
                                            <td className="p-4">
                                                <div className="space-y-0.5 text-[10px]">
                                                    <p className={professional.licenseDocument ? "font-bold text-emerald-600" : "text-slate-400"}>
                                                        License: {professional.licenseDocument ? "Submitted" : "Missing"}
                                                    </p>
                                                    <p className={professional.certificateDocument ? "font-bold text-emerald-600" : "text-slate-400"}>
                                                        Certificate: {professional.certificateDocument ? "Submitted" : "Missing"}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-500">{formatDate(professional.$createdAt)}</td>
                                            <td className="p-4 pr-6 text-right space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewProfessional(professional)}
                                                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditProfessional(professional)}
                                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm transition"
                                                >
                                                    Edit
                                                </button>
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