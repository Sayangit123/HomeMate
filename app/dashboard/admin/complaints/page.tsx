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
    Complaint,
    ComplaintStatus,
    ComplaintType,
    deleteComplaint,
    getAllComplaints,
    updateComplaint,
} from "@/lib/appwrite/complaint";

import {
    useAdminComplaintsStore,
} from "@/lib/stores/admin-complaints-store";

import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";

/* ============================================================
   FILTER OPTIONS
============================================================ */

const complaintTypes: Array<
    ComplaintType | "All"
> = [
    "All",
    "Customer Complaint",
    "Professional Dispute",
    "Booking Dispute",
];

const complaintStatuses: Array<
    ComplaintStatus | "All"
> = [
    "All",
    "Pending",
    "Under Review",
    "Resolved",
    "Rejected",
];

/* ============================================================
   STATUS STYLING
============================================================ */

const getStatusClass = (
    status: ComplaintStatus
) => {
    switch (status) {
        case "Pending":
            return "bg-amber-50 text-amber-700 border border-amber-200";

        case "Under Review":
            return "bg-blue-50 text-blue-700 border border-blue-200";

        case "Resolved":
            return "bg-emerald-50 text-emerald-700 border border-emerald-200";

        case "Rejected":
            return "bg-red-50 text-red-700 border border-red-200";

        default:
            return "bg-slate-100 text-slate-600 border border-slate-200";
    }
};

/* ============================================================
   COMPLAINT TYPE STYLING
============================================================ */

const getTypeClass = (
    type: ComplaintType
) => {
    switch (type) {
        case "Customer Complaint":
            return "bg-purple-50 text-purple-700 border border-purple-200";

        case "Professional Dispute":
            return "bg-orange-50 text-orange-700 border border-orange-200";

        case "Booking Dispute":
            return "bg-cyan-50 text-cyan-700 border border-cyan-200";

        default:
            return "bg-slate-100 text-slate-600 border border-slate-200";
    }
};

/* ============================================================
   DATE FORMATTER
============================================================ */

const formatDate = (
    date?: string
) => {
    if (!date) {
        return "—";
    }

    return new Date(date).toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
};

/* ============================================================
   MAIN PAGE
============================================================ */

export default function AdminComplaintsPage() {
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

    /* ========================================================
       ZUSTAND
    ======================================================== */

    const search =
        useAdminComplaintsStore(
            (state) => state.search
        );

    const typeFilter =
        useAdminComplaintsStore(
            (state) => state.typeFilter
        );

    const statusFilter =
        useAdminComplaintsStore(
            (state) => state.statusFilter
        );

    const selectedComplaintId =
        useAdminComplaintsStore(
            (state) =>
                state.selectedComplaintId
        );

    const setSearch =
        useAdminComplaintsStore(
            (state) => state.setSearch
        );

    const setTypeFilter =
        useAdminComplaintsStore(
            (state) =>
                state.setTypeFilter
        );

    const setStatusFilter =
        useAdminComplaintsStore(
            (state) =>
                state.setStatusFilter
        );

    const setSelectedComplaintId =
        useAdminComplaintsStore(
            (state) =>
                state.setSelectedComplaintId
        );

    /* ========================================================
       FETCH COMPLAINTS
    ======================================================== */

    const complaintsQuery =
        useQuery({
            queryKey: [
                "admin",
                "complaints",
            ],

            queryFn:
                getAllComplaints,

            retry: false,
        });

    const complaints =
        complaintsQuery.data || [];

    /* ========================================================
       UPDATE COMPLAINT
    ======================================================== */

    const updateMutation =
        useMutation({
            mutationFn: ({
                complaintId,
                data,
            }: {
                complaintId: string;
                data: {
                    status?: ComplaintStatus;
                    resolution?: string;
                    resolvedBy?: string;
                    resolvedAt?: string;
                };
            }) =>
                updateComplaint(
                    complaintId,
                    data
                ),

            onSuccess: async () => {
                await queryClient.invalidateQueries(
                    {
                        queryKey: [
                            "admin",
                            "complaints",
                        ],
                    }
                );
            },
        });

    /* ========================================================
       DELETE COMPLAINT
    ======================================================== */

    const deleteMutation =
        useMutation({
            mutationFn:
                deleteComplaint,

            onSuccess: async () => {
                await queryClient.invalidateQueries(
                    {
                        queryKey: [
                            "admin",
                            "complaints",
                        ],
                    }
                );

                setSelectedComplaintId(
                    null
                );
            },
        });

    /* ========================================================
       FILTER COMPLAINTS
    ======================================================== */

    const filteredComplaints =
        useMemo(() => {
            const normalizedSearch =
                search
                    .trim()
                    .toLowerCase();

            return complaints.filter(
                (complaint) => {
                    const matchesSearch =
                        !normalizedSearch ||
                        complaint.subject
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            ) ||
                        complaint.description
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            ) ||
                        complaint.customerId
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            ) ||
                        (
                            complaint.professionalId ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            ) ||
                        (
                            complaint.bookingId ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            );

                    const matchesType =
                        typeFilter ===
                            "All" ||
                        complaint.complaintType ===
                            typeFilter;

                    const matchesStatus =
                        statusFilter ===
                            "All" ||
                        complaint.status ===
                            statusFilter;

                    return (
                        matchesSearch &&
                        matchesType &&
                        matchesStatus
                    );
                }
            );
        }, [
            complaints,
            search,
            typeFilter,
            statusFilter,
        ]);

    /* ========================================================
       COUNTS
    ======================================================== */

    const pendingCount =
        useMemo(
            () =>
                complaints.filter(
                    (complaint) =>
                        complaint.status ===
                        "Pending"
                ).length,
            [complaints]
        );

    const reviewCount =
        useMemo(
            () =>
                complaints.filter(
                    (complaint) =>
                        complaint.status ===
                        "Under Review"
                ).length,
            [complaints]
        );

    const resolvedCount =
        useMemo(
            () =>
                complaints.filter(
                    (complaint) =>
                        complaint.status ===
                        "Resolved"
                ).length,
            [complaints]
        );

    const rejectedCount =
        useMemo(
            () =>
                complaints.filter(
                    (complaint) =>
                        complaint.status ===
                        "Rejected"
                ).length,
            [complaints]
        );

    const selectedComplaint =
        complaints.find(
            (complaint) =>
                complaint.$id ===
                selectedComplaintId
        ) || null;

    /* ========================================================
       UPDATE STATUS
    ======================================================== */

    const handleStatusChange =
        async (
            complaint: Complaint,
            status: ComplaintStatus
        ) => {
            const confirmation =
                await Swal.fire({
                    title:
                        "Update Complaint Status?",

                    text:
                        `Change status to "${status}"?`,

                    icon: "question",

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Yes, Update",

                    cancelButtonText:
                        "Cancel",

                    confirmButtonColor:
                        "#0f172a",

                    cancelButtonColor:
                        "#64748b",

                    reverseButtons:
                        true,
                });

            if (
                !confirmation.isConfirmed
            ) {
                return;
            }

            try {
                const data: {
                    status: ComplaintStatus;
                    resolvedAt?: string;
                } = {
                    status,
                };

                if (
                    status ===
                        "Resolved" ||
                    status ===
                        "Rejected"
                ) {
                    data.resolvedAt =
                        new Date().toISOString();
                }

                await updateMutation.mutateAsync(
                    {
                        complaintId:
                            complaint.$id,
                        data,
                    }
                );

                await Swal.fire({
                    icon: "success",

                    title:
                        "Status Updated",

                    text:
                        "Complaint status has been updated successfully.",

                    timer: 1400,

                    showConfirmButton:
                        false,
                });
            } catch (error) {
                console.error(
                    "Complaint status update error:",
                    error
                );

                await Swal.fire({
                    icon: "error",

                    title:
                        "Update Failed",

                    text:
                        "Unable to update the complaint status.",
                });
            }
        };

    /* ========================================================
       ADD / UPDATE RESOLUTION
    ======================================================== */

    const handleResolution =
        async (
            complaint: Complaint
        ) => {
            const result =
                await Swal.fire({
                    title:
                        "Complaint Resolution",

                    input: "textarea",

                    inputLabel:
                        "Enter resolution details",

                    inputValue:
                        complaint.resolution ||
                        "",

                    inputPlaceholder:
                        "Write how this complaint was handled...",

                    inputAttributes: {
                        "aria-label":
                            "Complaint resolution",
                    },

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Save Resolution",

                    cancelButtonText:
                        "Cancel",

                    confirmButtonColor:
                        "#0f172a",

                    cancelButtonColor:
                        "#64748b",

                    reverseButtons:
                        true,

                    inputValidator:
                        (value) => {
                            if (
                                !value ||
                                !value.trim()
                            ) {
                                return "Please enter a resolution.";
                            }

                            return null;
                        },
                });

            if (
                !result.isConfirmed
            ) {
                return;
            }

            try {
                await updateMutation.mutateAsync(
                    {
                        complaintId:
                            complaint.$id,

                        data: {
                            resolution:
                                result.value.trim(),

                            status:
                                complaint.status ===
                                    "Pending" ||
                                complaint.status ===
                                    "Under Review"
                                    ? "Resolved"
                                    : complaint.status,

                            resolvedAt:
                                new Date().toISOString(),
                        },
                    }
                );

                await Swal.fire({
                    icon: "success",

                    title:
                        "Resolution Saved",

                    text:
                        "The complaint resolution has been saved.",

                    timer: 1400,

                    showConfirmButton:
                        false,
                });
            } catch (error) {
                console.error(
                    "Complaint resolution error:",
                    error
                );

                await Swal.fire({
                    icon: "error",

                    title:
                        "Save Failed",

                    text:
                        "Unable to save the complaint resolution.",
                });
            }
        };

    /* ========================================================
       DELETE
    ======================================================== */

    const handleDelete =
        async (
            complaint: Complaint
        ) => {
            const result =
                await Swal.fire({
                    title:
                        "Delete Complaint?",

                    text:
                        "This complaint will be permanently deleted.",

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

            if (
                !result.isConfirmed
            ) {
                return;
            }

            try {
                await deleteMutation.mutateAsync(
                    complaint.$id
                );

                await Swal.fire({
                    icon: "success",

                    title:
                        "Complaint Deleted",

                    text:
                        "The complaint has been removed successfully.",

                    timer: 1400,

                    showConfirmButton:
                        false,
                });
            } catch (error) {
                console.error(
                    "Complaint deletion error:",
                    error
                );

                await Swal.fire({
                    icon: "error",

                    title:
                        "Delete Failed",

                    text:
                        "Unable to delete the complaint.",
                });
            }
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

    /* ========================================================
       LOADING
    ======================================================== */

    if (
        complaintsQuery.isLoading
    ) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="text-sm font-semibold text-slate-500">Loading Complaint Management...</p>
                </div>
            </div>
        );
    }

    /* ========================================================
       ERROR
    ======================================================== */

    if (
        complaintsQuery.isError
    ) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
                <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-xl">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-xl font-bold text-rose-500">
                        !
                    </div>
                    <h1 className="mt-4 text-xl font-bold text-slate-800">
                        Complaints Unavailable
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        We could not load complaint management information.
                    </p>
                    <button
                        type="button"
                        onClick={() =>
                            complaintsQuery.refetch()
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
                        Complaint Management
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
                            <p className="text-[10px] font-medium text-slate-400">Complaint Management</p>
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
                        <span className="text-blue-600">Complaints</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => complaintsQuery.refetch()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                        <span>↻</span>
                        <span>Refresh Complaints</span>
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
                                Complaint Management
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Review customer complaints, professional disputes and booking disputes from one central control panel.
                            </p>
                        </div>

                        <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                                📢
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900">User Dispute Resolution</p>
                                <p className="text-[11px] text-slate-500">Ensure high quality platform safety and support.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4 Top Metric Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">⏳</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Pending</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{pendingCount}</p>
                            <p className="text-[10px] text-amber-600 font-bold">Awaiting admin review</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">🔍</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Under Review</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{reviewCount}</p>
                            <p className="text-[10px] text-blue-600 font-bold">Currently being investigated</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">✓</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Resolved</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{resolvedCount}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">Successfully resolved</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 text-xl font-bold">✕</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Rejected</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{rejectedCount}</p>
                            <p className="text-[10px] text-rose-500 font-medium">Closed without resolution</p>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm items-center">
                    <div className="relative sm:col-span-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search complaints..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition shadow-sm"
                        />
                    </div>

                    <div>
                        <select
                            value={typeFilter}
                            onChange={(event) => setTypeFilter(event.target.value as any)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition shadow-sm"
                        >
                            {complaintTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as any)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition shadow-sm"
                        >
                            {complaintStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Complaint Table */}
                <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-900">All Complaints</h3>
                            <p className="text-xs text-slate-500">Complaint records and customer support queue.</p>
                        </div>
                        <span className="text-xs font-bold text-slate-400">Showing {filteredComplaints.length} of {complaints.length} complaints</span>
                    </div>

                    {complaintsQuery.isLoading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                                <p className="text-xs font-bold text-slate-400">Loading complaints...</p>
                            </div>
                        </div>
                    ) : filteredComplaints.length === 0 ? (
                        <div className="p-16 text-center">
                            <span className="text-4xl">⚠</span>
                            <h3 className="text-base font-bold text-slate-900 mt-3">No Complaints Found</h3>
                            <p className="text-xs text-slate-400 mt-1">There are no complaints matching the current search or filters.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">Complaint</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Customer ID</th>
                                        <th className="p-4">Booking ID</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Created</th>
                                        <th className="p-4 pr-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredComplaints.map((complaint) => (
                                        <tr key={complaint.$id} className="hover:bg-slate-50/60 transition">
                                            <td className="p-4 pl-6">
                                                <p className="font-bold text-slate-900">{complaint.subject}</p>
                                                <p className="mt-0.5 max-w-xs truncate text-[11px] text-slate-400">{complaint.description}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getTypeClass(complaint.complaintType)}`}>
                                                    {complaint.complaintType}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-[11px] text-slate-500">{complaint.customerId}</td>
                                            <td className="p-4 font-mono text-[11px] text-slate-500">{complaint.bookingId || "—"}</td>
                                            <td className="p-4">
                                                <select
                                                    value={complaint.status}
                                                    disabled={updateMutation.isPending}
                                                    onChange={(e) => handleStatusChange(complaint, e.target.value as ComplaintStatus)}
                                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase outline-none shadow-sm cursor-pointer ${getStatusClass(complaint.status)}`}
                                                >
                                                    {complaintStatuses.filter((s) => s !== "All").map((s) => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-4 text-slate-500">{formatDate(complaint.$createdAt)}</td>
                                            <td className="p-4 pr-6 text-right">
                                                <div className="flex flex-row items-center justify-end gap-2 whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedComplaintId(complaint.$id)}
                                                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResolution(complaint)}
                                                        disabled={updateMutation.isPending}
                                                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white shadow-sm transition disabled:opacity-50"
                                                    >
                                                        Resolve
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* ==========================================================
               DETAIL MODAL
            ========================================================== */}
            {selectedComplaint && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-black text-slate-900">{selectedComplaint.subject}</h3>
                            <button onClick={() => setSelectedComplaintId(null)} className="text-slate-400 hover:text-slate-700">✕</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div>
                                <strong className="text-slate-400 uppercase text-[10px] block">Complaint Type</strong>
                                <span className="font-bold text-slate-800">{selectedComplaint.complaintType}</span>
                            </div>
                            <div>
                                <strong className="text-slate-400 uppercase text-[10px] block">Status</strong>
                                <span className="font-bold text-slate-800">{selectedComplaint.status}</span>
                            </div>
                            <div>
                                <strong className="text-slate-400 uppercase text-[10px] block">Customer ID</strong>
                                <span className="font-mono text-slate-800">{selectedComplaint.customerId}</span>
                            </div>
                            <div>
                                <strong className="text-slate-400 uppercase text-[10px] block">Booking ID</strong>
                                <span className="font-mono text-slate-800">{selectedComplaint.bookingId || "—"}</span>
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description</p>
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                                {selectedComplaint.description}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Resolution Details</p>
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                                {selectedComplaint.resolution || "No resolution added yet."}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => handleDelete(selectedComplaint)}
                                disabled={deleteMutation.isPending}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-sm disabled:opacity-50"
                            >
                                Delete Complaint
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleStatusChange(selectedComplaint, "Under Review")}
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm"
                                >
                                    Mark Under Review
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleResolution(selectedComplaint)}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
                                >
                                    Add / Edit Resolution
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}