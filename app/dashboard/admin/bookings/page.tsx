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

import { getAllMembers } from "@/lib/appwrite/member";
import { getAllServices } from "@/lib/appwrite/service";
import {
    updateBookingStatus,
    deleteBooking,
    BookingStatus,
} from "@/lib/appwrite/booking";
import { getPropertyById } from "@/lib/appwrite/property";
import { Databases, Query } from "appwrite";
import client from "@/lib/appwrite/client";
import { useAdminBookingsStore } from "@/lib/stores/admin-bookings-store";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const BOOKINGS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_BOOKINGS_TABLE_ID ||
    "bookings";

type Booking = {
    $id: string;
    customerId: string;
    professionalId: string;
    serviceId: string;
    propertyId: string;
    bookingDate: string;
    bookingTime: string;
    status: BookingStatus;
    notes?: string | null;
    $createdAt?: string;
};

type Member = {
    $id: string;
    userId: string;
    fullName: string;
    phone?: string | null;
    role: string;
};

type Service = {
    $id: string;
    userId: string;
    serviceName: string;
    description?: string | null;
    duration: number;
    price: number;
};

type Property = {
    $id: string;
    userId: string;
    propertyName: string;
    propertyType: string;
    address: string;
};

const statuses: (
    | "All"
    | BookingStatus
)[] = [
    "All",
    "Requested",
    "Accepted",
    "InProgress",
    "Completed",
    "Cancelled",
];

const getStatusClasses = (
    status: BookingStatus
) => {
    switch (status) {
        case "Requested":
            return "bg-amber-50 text-amber-700 border border-amber-200";

        case "Accepted":
            return "bg-blue-50 text-blue-700 border border-blue-200";

        case "InProgress":
            return "bg-purple-50 text-purple-700 border border-purple-200";

        case "Completed":
            return "bg-emerald-50 text-emerald-700 border border-emerald-200";

        case "Cancelled":
            return "bg-red-50 text-red-700 border border-red-200";

        default:
            return "bg-slate-50 text-slate-700 border border-slate-200";
    }
};

const getStatusLabel = (
    status: BookingStatus
) => {
    if (status === "InProgress") {
        return "In Progress";
    }

    return status;
};

const formatBookingDate = (
    date: string
) => {
    if (!date) {
        return "N/A";
    }

    const parsedDate = new Date(date);

    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {
        return date;
    }

    return parsedDate.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
};

export default function AdminBookingsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const {
        search,
        statusFilter,
        updatingId,
        setSearch,
        setStatusFilter,
        setUpdatingId,
    } = useAdminBookingsStore();

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
        LOAD DATA - TANSTACK QUERY
    ======================================================== */

    const bookingsQuery = useQuery({
        queryKey: [
            "admin",
            "bookings",
        ],

        queryFn: async () => {
            try {
                const [
                    bookingsResponse,
                    membersResponse,
                    servicesResponse,
                ] = await Promise.all([
                    databases.listDocuments(
                        DATABASE_ID,
                        BOOKINGS_TABLE_ID,
                        [
                            Query.orderDesc(
                                "$createdAt"
                            ),
                        ]
                    ),

                    getAllMembers(),

                    getAllServices(),
                ]);

                const bookingDocuments =
                    bookingsResponse.documents as unknown as Booking[];

                const memberDocuments =
                    membersResponse.documents as unknown as Member[];

                const serviceDocuments =
                    servicesResponse.documents as unknown as Service[];

                const uniquePropertyIds =
                    Array.from(
                        new Set(
                            bookingDocuments
                                .map(
                                    (booking) =>
                                        booking.propertyId
                                )
                                .filter(Boolean)
                        )
                    );

                const propertyResults =
                    await Promise.all(
                        uniquePropertyIds.map(
                            async (
                                propertyId
                            ) => {
                                try {
                                    return await getPropertyById(
                                        propertyId
                                    );
                                } catch {
                                    return null;
                                }
                            }
                        )
                    );

                const propertyDocuments =
                    propertyResults.filter(
                        Boolean
                    ) as unknown as Property[];

                return {
                    bookings:
                        bookingDocuments,

                    members:
                        memberDocuments,

                    services:
                        serviceDocuments,

                    properties:
                        propertyDocuments,
                };
            } catch (error) {
                console.error(
                    "Failed to load admin bookings:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Unable to Load Bookings",
                    text: "Something went wrong while loading booking information.",
                    confirmButtonColor:
                        "#0f172a",
                });

                throw error;
            }
        },
    });

    const bookings =
        bookingsQuery.data?.bookings ||
        [];

    const members =
        bookingsQuery.data?.members ||
        [];

    const services =
        bookingsQuery.data?.services ||
        [];

    const properties =
        bookingsQuery.data?.properties ||
        [];

    /* ========================================================
        UPDATE STATUS - TANSTACK MUTATION
    ======================================================== */

    const updateStatusMutation =
        useMutation({
            mutationFn: async ({
                bookingId,
                status,
            }: {
                bookingId: string;
                status: BookingStatus;
            }) => {
                await updateBookingStatus(
                    bookingId,
                    status
                );
            },

            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: [
                        "admin",
                        "bookings",
                    ],
                });
            },
        });

    /* ========================================================
        DELETE BOOKING - TANSTACK MUTATION
    ======================================================== */

    const deleteBookingMutation =
        useMutation({
            mutationFn: async (
                bookingId: string
            ) => {
                await deleteBooking(
                    bookingId
                );
            },

            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: [
                        "admin",
                        "bookings",
                    ],
                });
            },
        });

    const getCustomer = (
        customerId: string
    ) => {
        return members.find(
            (member) =>
                member.userId ===
                customerId
        );
    };

    const getProfessional = (
        professionalId: string
    ) => {
        return members.find(
            (member) =>
                member.userId ===
                professionalId
        );
    };

    const getService = (
        serviceId: string
    ) => {
        return services.find(
            (service) =>
                service.$id ===
                serviceId
        );
    };

    const getProperty = (
        propertyId: string
    ) => {
        return properties.find(
            (property) =>
                property.$id ===
                propertyId
        );
    };

    /* ========================================================
        FILTER BOOKINGS
    ======================================================== */

    const filteredBookings =
        useMemo(() => {
            const searchText =
                search
                    .toLowerCase()
                    .trim();

            return bookings.filter(
                (booking) => {
                    const customer =
                        getCustomer(
                            booking.customerId
                        );

                    const professional =
                        getProfessional(
                            booking.professionalId
                        );

                    const service =
                        getService(
                            booking.serviceId
                        );

                    const property =
                        getProperty(
                            booking.propertyId
                        );

                    const matchesSearch =
                        !searchText ||
                        customer?.fullName
                            ?.toLowerCase()
                            .includes(
                                searchText
                            ) ||
                        professional?.fullName
                            ?.toLowerCase()
                            .includes(
                                searchText
                            ) ||
                        service?.serviceName
                            ?.toLowerCase()
                            .includes(
                                searchText
                            ) ||
                        property?.propertyName
                            ?.toLowerCase()
                            .includes(
                                searchText
                            ) ||
                        booking.$id
                            ?.toLowerCase()
                            .includes(
                                searchText
                            );

                    const matchesStatus =
                        statusFilter ===
                            "All" ||
                        booking.status ===
                            statusFilter;

                    return (
                        matchesSearch &&
                        matchesStatus
                    );
                }
            );
        }, [
            bookings,
            members,
            services,
            properties,
            search,
            statusFilter,
        ]);

    /* ========================================================
        UPDATE STATUS
    ======================================================== */

    const handleStatusChange = async (
        booking: Booking,
        status: BookingStatus
    ) => {
        if (
            booking.status ===
            status
        ) {
            return;
        }

        const result =
            await Swal.fire({
                title:
                    "Update Booking Status?",

                text: `Change status from "${getStatusLabel(
                    booking.status
                )}" to "${getStatusLabel(
                    status
                )}"?`,

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
            });

        if (
            !result.isConfirmed
        ) {
            return;
        }

        try {
            setUpdatingId(
                booking.$id
            );

            await updateStatusMutation.mutateAsync(
                {
                    bookingId:
                        booking.$id,

                    status,
                }
            );

            await Swal.fire({
                icon: "success",

                title:
                    "Status Updated",

                text: "The booking status has been updated successfully.",

                confirmButtonColor:
                    "#0f172a",
            });
        } catch (error) {
            console.error(
                "Status update error:",
                error
            );

            Swal.fire({
                icon: "error",

                title:
                    "Update Failed",

                text: "Unable to update the booking status.",

                confirmButtonColor:
                    "#0f172a",
            });
        } finally {
            setUpdatingId(
                null
            );
        }
    };

    /* ========================================================
        VIEW DETAILS
    ======================================================== */

    const handleViewDetails = async (
        booking: Booking
    ) => {
        const customer =
            getCustomer(
                booking.customerId
            );

        const professional =
            getProfessional(
                booking.professionalId
            );

        const service =
            getService(
                booking.serviceId
            );

        const property =
            getProperty(
                booking.propertyId
            );

        Swal.fire({
            title:
                "Booking Details",

            width: 650,

            html: `
                <div style="text-align:left; line-height:1.8; font-size:14px">

                    <div style="margin-bottom:12px">
                        <strong>Booking ID:</strong><br/>
                        <span style="color:#64748b">
                            ${booking.$id}
                        </span>
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Customer:</strong><br/>
                        ${
                            customer?.fullName ||
                            booking.customerId
                        }
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Professional:</strong><br/>
                        ${
                            professional?.fullName ||
                            booking.professionalId
                        }
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Service:</strong><br/>
                        ${
                            service?.serviceName ||
                            booking.serviceId
                        }
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Property:</strong><br/>
                        ${
                            property?.propertyName ||
                            booking.propertyId
                        }
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Property Address:</strong><br/>
                        ${
                            property?.address ||
                            "Not available"
                        }
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Booking Date:</strong><br/>
                        ${formatBookingDate(
                            booking.bookingDate
                        )}
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Booking Time:</strong><br/>
                        ${booking.bookingTime}
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Service Price:</strong><br/>
                        ₹${
                            service?.price ??
                            "N/A"
                        }
                    </div>

                    <div style="margin-bottom:12px">
                        <strong>Status:</strong><br/>
                        ${getStatusLabel(
                            booking.status
                        )}
                    </div>

                    <div>
                        <strong>Notes:</strong><br/>
                        ${
                            booking.notes ||
                            "No notes provided."
                        }
                    </div>

                </div>
            `,

            confirmButtonText:
                "Close",

            confirmButtonColor:
                "#0f172a",
        });
    };

    /* ========================================================
        DELETE BOOKING
    ======================================================== */

    const handleDelete = async (
        booking: Booking
    ) => {
        const result =
            await Swal.fire({
                title:
                    "Delete Booking?",

                text: "This action cannot be undone.",

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
            setUpdatingId(
                booking.$id
            );

            await deleteBookingMutation.mutateAsync(
                booking.$id
            );

            await Swal.fire({
                icon: "success",

                title:
                    "Booking Deleted",

                text: "The booking has been removed successfully.",

                confirmButtonColor:
                    "#0f172a",
            });
        } catch (error) {
            console.error(
                "Delete booking error:",
                error
            );

            Swal.fire({
                icon: "error",

                title:
                    "Delete Failed",

                text: "Unable to delete this booking.",

                confirmButtonColor:
                    "#0f172a",
            });
        } finally {
            setUpdatingId(
                null
            );
        }
    };

    /* ========================================================
        STATISTICS
    ======================================================== */

    const totalBookings =
        bookings.length;

    const requestedBookings =
        bookings.filter(
            (booking) =>
                booking.status ===
                "Requested"
        ).length;

    const activeBookings =
        bookings.filter(
            (booking) =>
                booking.status ===
                    "Accepted" ||
                booking.status ===
                    "InProgress"
        ).length;

    const completedBookings =
        bookings.filter(
            (booking) =>
                booking.status ===
                "Completed"
        ).length;

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
        UI
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
                    <Link href="/dashboard/admin/bookings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md"><span>📅</span><span>Bookings</span></Link>
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
                    <Link href="/dashboard/admin/bookings" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"><span>📅</span><span>Bookings</span></Link>
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
                        Booking Management
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
                            <p className="text-[10px] font-medium text-slate-400">Booking Management</p>
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
                        <span className="text-blue-600">Bookings</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => bookingsQuery.refetch()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                        <span>↻</span>
                        <span>Refresh Bookings</span>
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
                                Booking Management
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Monitor and manage all HomeMate service bookings.
                            </p>
                        </div>

                        <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                                📅
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900">Schedule Oversight</p>
                                <p className="text-[11px] text-slate-500">Track service assignments and progress.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4 Top Metric Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">📅</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Bookings</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalBookings}</p>
                            <p className="text-[10px] text-slate-400">Platform reservations</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">⏳</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Requested</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{requestedBookings}</p>
                            <p className="text-[10px] text-amber-600 font-bold">Awaiting confirmation</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">⚡</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Active</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{activeBookings}</p>
                            <p className="text-[10px] text-blue-600 font-bold">In progress / accepted</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">✓</div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Completed</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{completedBookings}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">Successfully finished</p>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm items-center">
                    <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Search</label>
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search customer, professional, service, property..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-4 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Booking Status</label>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as any)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition shadow-sm"
                        >
                            {statuses.map((status) => (
                                <option key={status} value={status}>
                                    {status === "InProgress" ? "In Progress" : status}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Bookings Table */}
                <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-900">All Bookings</h3>
                            <p className="text-xs text-slate-500">Monitor and manage all service bookings.</p>
                        </div>
                        <span className="text-xs font-bold text-slate-400">Showing {filteredBookings.length} of {bookings.length} bookings</span>
                    </div>

                    {bookingsQuery.isLoading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                                <p className="text-xs font-bold text-slate-400">Loading bookings...</p>
                            </div>
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="p-16 text-center">
                            <span className="text-4xl">📅</span>
                            <h3 className="text-base font-bold text-slate-900 mt-3">No Bookings Found</h3>
                            <p className="text-xs text-slate-400 mt-1">No bookings match your current search or status filter.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 pl-6">Booking</th>
                                        <th className="p-4">Customer</th>
                                        <th className="p-4">Professional</th>
                                        <th className="p-4">Service</th>
                                        <th className="p-4">Property</th>
                                        <th className="p-4">Schedule</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredBookings.map((booking) => {
                                        const customer = getCustomer(booking.customerId);
                                        const professional = getProfessional(booking.professionalId);
                                        const service = getService(booking.serviceId);
                                        const property = getProperty(booking.propertyId);

                                        return (
                                            <tr key={booking.$id} className="hover:bg-slate-50/60 transition">
                                                <td className="p-4 pl-6">
                                                    <p className="font-bold text-slate-900">#{booking.$id.slice(0, 8)}</p>
                                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                                        {booking.$createdAt ? new Date(booking.$createdAt).toLocaleDateString("en-IN") : "N/A"}
                                                    </p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-900">{customer?.fullName || "Unknown Customer"}</p>
                                                    <p className="text-[10px] text-slate-400">{customer?.phone || booking.customerId}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-900">{professional?.fullName || "Unknown Professional"}</p>
                                                    <p className="text-[10px] text-slate-400">{professional?.phone || booking.professionalId}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-900">{service?.serviceName || "Unknown Service"}</p>
                                                    <p className="text-[10px] text-slate-400">{service ? `₹${service.price} • ${service.duration}m` : booking.serviceId}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-900">{property?.propertyName || "Property"}</p>
                                                    <p className="mt-0.5 max-w-[150px] truncate text-[10px] text-slate-400">{property?.address || "Address N/A"}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-900">{formatBookingDate(booking.bookingDate)}</p>
                                                    <p className="text-[10px] text-slate-400">{booking.bookingTime}</p>
                                                </td>
                                                <td className="p-4">
                                                    <select
                                                        value={booking.status}
                                                        disabled={updatingId === booking.$id}
                                                        onChange={(e) => handleStatusChange(booking, e.target.value as BookingStatus)}
                                                        className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase outline-none shadow-sm cursor-pointer ${getStatusClasses(booking.status)}`}
                                                    >
                                                        <option value="Requested">Requested</option>
                                                        <option value="Accepted">Accepted</option>
                                                        <option value="InProgress">In Progress</option>
                                                        <option value="Completed">Completed</option>
                                                        <option value="Cancelled">Cancelled</option>
                                                    </select>
                                                </td>
                                                <td className="p-4 pr-6 text-right space-x-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(booking)}
                                                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={updatingId === booking.$id || deleteBookingMutation.isPending}
                                                        onClick={() => handleDelete(booking)}
                                                        className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm transition disabled:opacity-50"
                                                    >
                                                        Delete
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