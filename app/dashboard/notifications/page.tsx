"use client";

import {
    useState,
    useMemo,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import Swal from "sweetalert2";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import {
    getCurrentUser,
    logoutAccount,
} from "@/lib/appwrite/account";

import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
} from "@/lib/appwrite/notification";

import {
    getCurrentMember,
} from "@/lib/appwrite/database";

import {
    getProfileImageUrl,
} from "@/lib/appwrite/member";

import {
    useNotificationStore,
} from "@/lib/stores/notification-store";

import { useAuthStore } from "@/lib/stores/auth-store";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Notification {
    $id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    referenceId?: string | null;
    $createdAt: string;
}

/* ================= NOTIFICATION ICON ================= */

const getNotificationIcon = (
    type: string
) => {
    const normalizedType =
        type.toLowerCase();

    if (
        normalizedType.includes(
            "booking"
        )
    ) {
        return "📅";
    }

    if (
        normalizedType.includes(
            "order"
        )
    ) {
        return "📦";
    }

    if (
        normalizedType.includes(
            "promotion"
        )
    ) {
        return "🎁";
    }

    if (
        normalizedType.includes(
            "system"
        )
    ) {
        return "📢";
    }

    if (
        normalizedType.includes(
            "message"
        )
    ) {
        return "💬";
    }

    return "🔔";
};

/* ================= NOTIFICATION LABEL ================= */

const getNotificationTypeLabel = (
    type: string
) => {
    if (!type) {
        return "Notification";
    }

    return type
        .replace(
            /([A-Z])/g,
            " $1"
        )
        .replace(
            /^./,
            (letter) =>
                letter.toUpperCase()
        );
};

export default function NotificationsPage() {
    const router = useRouter();
    const queryClient =
        useQueryClient();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>("All");

    const {
        selectedNotificationId,
        setSelectedNotificationId,
    } = useNotificationStore();

    const [
        actionLoading,
        setActionLoading,
    ] = useState(false);

    const isSelectedActionLoading =
        actionLoading &&
        Boolean(
            selectedNotificationId
        );

    // Zustand store sync for user profile
    const storedUser = useAuthStore((state) => state.user);
    const clearUser = useAuthStore((state) => state.clearUser);

    /* ================= CURRENT USER ================= */

    const currentUserQuery =
        useQuery({
            queryKey: [
                "notifications",
                "current-user",
            ],

            queryFn:
                getCurrentUser,
        });

    const currentUserId =
        currentUserQuery.data?.$id ||
        "";

    /* ================= NAVBAR PROFILE ================= */
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

    const fullName = memberData?.fullName?.trim() || currentUserQuery.data?.name?.trim() || storedUser?.fullName || "Sonu Bhoumik";
    const userEmail = currentUserQuery.data?.email || storedUser?.email || "sonu@gmail.com";
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

    /* ================= LOAD NOTIFICATIONS ================= */

    const notificationsQuery =
        useQuery({
            queryKey: [
                "notifications",
                currentUserId,
            ],

            queryFn:
                async () => {
                    if (
                        !currentUserId
                    ) {
                        return [] as Notification[];
                    }

                    const response =
                        await getUserNotifications(
                            currentUserId
                        );

                    return response
                        .documents as unknown as Notification[];
                },

            enabled:
                Boolean(
                    currentUserId
                ),
        });

    const notifications =
        notificationsQuery.data ||
        [];

    /* ================= MARK ONE AS READ ================= */

    const markAsReadMutation =
        useMutation({
            mutationFn:
                async (
                    notificationId: string
                ) => {
                    await markNotificationAsRead(
                        notificationId
                    );

                    return notificationId;
                },

            onSuccess:
                (
                    notificationId
                ) => {
                    queryClient.setQueryData<
                        Notification[]
                    >(
                        [
                            "notifications",
                            currentUserId,
                        ],

                        (
                            previous = []
                        ) =>
                            previous.map(
                                (
                                    item
                                ) =>
                                    item.$id ===
                                    notificationId
                                        ? {
                                            ...item,
                                            isRead:
                                                true,
                                        }
                                        : item
                            )
                    );
                },

            onError:
                async (
                    error
                ) => {
                    console.error(
                        "Mark notification as read error:",
                        error
                    );

                    await Swal.fire({
                        icon: "error",
                        title: "Action Failed",
                        text: "Unable to mark this notification as read.",
                        confirmButtonColor:
                            "#0f172a",
                    });
                },

            onSettled:
                () => {
                    setActionLoading(
                        false
                    );
                },
        });

    const handleMarkAsRead =
        async (
            notification: Notification
        ) => {
            if (
                notification.isRead
            ) {
                return;
            }

            try {
                setSelectedNotificationId(
                    notification.$id
                );

                setActionLoading(
                    true
                );

                await markAsReadMutation.mutateAsync(
                    notification.$id
                );
            } catch {
                // Error handled by mutation.
            }
        };

    /* ================= MARK ALL AS READ ================= */

    const markAllAsReadMutation =
        useMutation({
            mutationFn:
                async () => {
                    if (
                        !currentUserId
                    ) {
                        throw new Error(
                            "Current user not found."
                        );
                    }

                    await markAllNotificationsAsRead(
                        currentUserId
                    );
                },

            onSuccess:
                async () => {
                    queryClient.setQueryData<
                        Notification[]
                    >(
                        [
                            "notifications",
                            currentUserId,
                        ],

                        (
                            previous = []
                        ) =>
                            previous.map(
                                (
                                    item
                                ) => ({
                                    ...item,
                                    isRead:
                                        true,
                                })
                            )
                    );

                    await Swal.fire({
                        icon: "success",
                        title:
                            "All Notifications Read",
                        text:
                            "All your notifications have been marked as read.",
                        confirmButtonColor:
                            "#0f172a",
                        timer: 1600,
                        showConfirmButton:
                            false,
                    });
                },

            onError:
                async (
                    error
                ) => {
                    console.error(
                        "Mark all notifications as read error:",
                        error
                    );

                    await Swal.fire({
                        icon: "error",
                        title:
                            "Action Failed",
                        text:
                            "Unable to mark all notifications as read.",
                        confirmButtonColor:
                            "#0f172a",
                    });
                },

            onSettled:
                () => {
                    setActionLoading(
                        false
                    );
                },
        });

    const handleMarkAllAsRead =
        async () => {
            if (
                !currentUserId ||
                unreadCount === 0
            ) {
                return;
            }

            try {
                setActionLoading(
                    true
                );

                await markAllAsReadMutation.mutateAsync();
            } catch {
                // Error handled by mutation.
            }
        };

    /* ================= DELETE NOTIFICATION ================= */

    const deleteMutation =
        useMutation({
            mutationFn:
                async (
                    notificationId: string
                ) => {
                    await deleteNotification(
                        notificationId
                    );

                    return notificationId;
                },

            onSuccess:
                async (
                    notificationId
                ) => {
                    queryClient.setQueryData<
                        Notification[]
                    >(
                        [
                            "notifications",
                            currentUserId,
                        ],

                        (
                            previous = []
                        ) =>
                            previous.filter(
                                (
                                    item
                                ) =>
                                    item.$id !==
                                    notificationId
                            )
                    );

                    setSelectedNotificationId(
                        null
                    );

                    await Swal.fire({
                        icon: "success",
                        title:
                            "Deleted",
                        text:
                            "Notification deleted successfully.",
                        confirmButtonColor:
                            "#0f172a",
                        timer: 1400,
                        showConfirmButton:
                            false,
                    });
                },

            onError:
                async (
                    error
                ) => {
                    console.error(
                        "Delete notification error:",
                        error
                    );

                    await Swal.fire({
                        icon: "error",
                        title:
                            "Delete Failed",
                        text:
                            "Unable to delete this notification.",
                        confirmButtonColor:
                            "#0f172a",
                    });
                },

            onSettled:
                () => {
                    setActionLoading(
                        false
                    );
                },
        });

    const handleDelete =
        async (
            notificationId: string
        ) => {
            const result =
                await Swal.fire({
                    icon: "warning",
                    title:
                        "Delete Notification?",
                    text:
                        "This notification will be permanently removed.",
                    showCancelButton:
                        true,
                    confirmButtonText:
                        "Delete",
                    cancelButtonText:
                        "Cancel",
                    confirmButtonColor:
                        "#0f172a",
                    cancelButtonColor:
                        "#94a3b8",
                });

            if (
                !result.isConfirmed
            ) {
                return;
            }

            try {
                setSelectedNotificationId(
                    notificationId
                );

                setActionLoading(
                    true
                );

                await deleteMutation.mutateAsync(
                    notificationId
                );
            } catch {
                // Error handled by mutation.
            }
        };

    /* ================= REFRESH ================= */

    const handleRefresh =
        async () => {
            if (
                !currentUserId
            ) {
                return;
            }

            try {
                setActionLoading(
                    true
                );

                await notificationsQuery.refetch();

                await Swal.fire({
                    icon: "success",
                    title:
                        "Updated",
                    text:
                        "Notifications refreshed.",
                    confirmButtonColor:
                        "#0f172a",
                    timer: 1000,
                    showConfirmButton:
                        false,
                });
            } catch (
                error
            ) {
                console.error(
                    "Refresh notification error:",
                    error
                );
            } finally {
                setActionLoading(
                    false
                );
            }
        };

    /* ================= COUNTS ================= */

    const unreadCount =
        notifications.filter(
            (item) =>
                !item.isRead
        ).length;

    const readCount =
        notifications.length -
        unreadCount;

    /* Filtered notifications based on selected tab pill */
    const filteredNotifications = useMemo(() => {
        if (activeFilter === "All") return notifications;
        if (activeFilter === "Orders") return notifications.filter((n) => n.type.toLowerCase().includes("order"));
        if (activeFilter === "Maintenance") return notifications.filter((n) => n.type.toLowerCase().includes("maintenance") || n.type.toLowerCase().includes("booking"));
        if (activeFilter === "Messages") return notifications.filter((n) => n.type.toLowerCase().includes("message"));
        if (activeFilter === "System") return notifications.filter((n) => n.type.toLowerCase().includes("system") || n.type.toLowerCase().includes("announcement"));
        return notifications;
    }, [notifications, activeFilter]);

    /* ================= DATE ================= */

    const formatDate = (
        date: string
    ) => {
        if (!date) {
            return "";
        }

        return new Date(
            date
        ).toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    };

    /* ================= LOGOUT ================= */
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

            [
                "token",
                "accessToken",
                "authToken",
                "user",
                "userData",
                "role",
                "userRole",
            ].forEach((key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });

            await Swal.fire({
                icon: "success",
                title: "Logged Out",
                text: "You have been successfully logged out of HomeMate.",
                timer: 1400,
                showConfirmButton: false,
            });

            window.location.href = "/login";
        } catch (error) {
            console.error("Logout error:", error);
            clearUser();
            setLoggingOut(false);
            window.location.href = "/login";
        }
    };

    /* ================= LOADING ================= */

    const loading =
        currentUserQuery.isLoading ||
        (
            Boolean(
                currentUserId
            ) &&
            notificationsQuery.isLoading
        );

    /* ================= AUTH ERROR ================= */

    if (
        currentUserQuery.isError
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9]">
                <div className="text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center border border-slate-200 bg-white text-2xl">
                        ⚠️
                    </div>

                    <h2 className="mt-5 text-lg font-bold text-slate-950">
                        Authentication Error
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Unable to identify the current user.
                    </p>

                </div>
            </main>
        );
    }

    /* ================= NOTIFICATION ERROR ================= */

    if (
        notificationsQuery.isError
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9]">
                <div className="text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center border border-slate-200 bg-white text-2xl">
                        ⚠️
                    </div>

                    <h2 className="mt-5 text-lg font-bold text-slate-950">
                        Unable to Load Notifications
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Something went wrong while loading your notifications.
                    </p>

                </div>
            </main>
        );
    }

    /* ================= MAIN LOADING ================= */

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
                <div className="text-center">

                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />

                    <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Loading Notifications...
                    </p>

                </div>
            </main>
        );
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
                            </svg>
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

                <nav
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar px-4 py-4 text-xs font-bold"
                >
                    <Link
                        href="/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">🏠</span>
                        <span>Dashboard</span>
                    </Link>
                    <Link
                        href="/dashboard/properties"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">🏘️</span>
                        <span>My Properties</span>
                    </Link>
                    <Link
                        href="/dashboard/maintenance"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">🔧</span>
                        <span>Maintenance</span>
                    </Link>
                    <Link
                        href="/dashboard/bookings/new"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">🛠️</span>
                        <span>Book a Service</span>
                    </Link>
                    <Link
                        href="/dashboard/bookings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">📅</span>
                        <span>My Bookings</span>
                    </Link>
                    <Link
                        href="/dashboard/marketplace"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">🛒</span>
                        <span>Marketplace</span>
                    </Link>
                    <Link
                        href="/dashboard/service-history"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">⏱️</span>
                        <span>Service History</span>
                    </Link>
                    <Link
                        href="/dashboard/messages"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">💬</span>
                        <span>Messages</span>
                    </Link>
                    <Link
                        href="/dashboard/notifications"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
                    >
                        <span className="text-base">🔔</span>
                        <span>Notifications</span>
                    </Link>
                    <Link
                        href="/dashboard/professionals"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
                    >
                        <span className="text-base">🔍</span>
                        <span>Find Professionals</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={() => {
                            setMobileMenuOpen(false);
                            handleLogout();
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition"
                    >
                        <span>🚪</span>
                        <span>Logout Account</span>
                    </button>
                </div>
            </aside>

            {/* Desktop Fixed Navy Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-900/10 bg-[#0b1a2e] text-white lg:flex">
                <div className="flex h-20 items-center gap-3 px-6 border-b border-white/10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
                        </svg>
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

                <nav
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    className="flex-1 space-y-1 overflow-y-auto no-scrollbar px-4 py-5 text-xs font-bold"
                >
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">🏠</span>
                        <span>Dashboard</span>
                    </Link>

                    <Link
                        href="/dashboard/properties"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">🏘️</span>
                        <span>My Properties</span>
                    </Link>

                    <Link
                        href="/dashboard/maintenance"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">🔧</span>
                        <span>Maintenance</span>
                    </Link>

                    <Link
                        href="/dashboard/bookings/new"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">🛠️</span>
                        <span>Book a Service</span>
                    </Link>

                    <Link
                        href="/dashboard/bookings"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">📅</span>
                        <span>My Bookings</span>
                    </Link>

                    <Link
                        href="/dashboard/marketplace"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">🛒</span>
                        <span>Marketplace</span>
                    </Link>

                    <Link
                        href="/dashboard/service-history"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">⏱️</span>
                        <span>Service History</span>
                    </Link>

                    <Link
                        href="/dashboard/messages"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">💬</span>
                        <span>Messages</span>
                    </Link>

                    <Link
                        href="/dashboard/notifications"
                        className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
                    >
                        <span className="text-base">🔔</span>
                        <span>Notifications</span>
                    </Link>

                    <Link
                        href="/dashboard/professionals"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        <span className="text-base">🔍</span>
                        <span>Find Professionals</span>
                    </Link>

                    <div className="pt-4 border-t border-white/10 space-y-1">
                        <Link
                            href="/dashboard/profile"
                            className="flex items-center gap-3.5 rounded-xl px-4 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                        >
                            <span className="text-base">👤</span>
                            <span>My Profile</span>
                        </Link>
                        <Link
                            href="/dashboard/settings"
                            className="flex items-center gap-3.5 rounded-xl px-4 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                        >
                            <span className="text-base">⚙️</span>
                            <span>Settings</span>
                        </Link>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-2 text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                        >
                            <span className="text-base">🚪</span>
                            <span>Logout</span>
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
                            Stay updated,<br />Keep your home happy!
                        </h4>
                        <p className="mt-1 text-[10px] text-slate-400">
                            Get real-time alerts for your bookings, services and more.
                        </p>
                        <Link
                            href="/dashboard/bookings/new"
                            className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
                        >
                            <span>Explore Now</span>
                            <span>→</span>
                        </Link>
                    </div>
                </div>
            </aside>

            {/* Top Navbar */}
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur lg:ml-64">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        aria-label="Open mobile menu"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 lg:hidden"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-blue-600">
                        NOTIFICATIONS PORTAL
                    </span>
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
                                <img
                                    src={userProfileImage}
                                    alt={fullName}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center font-black text-xs text-blue-600 bg-blue-100">
                                    {initials}
                                </div>
                            )}
                        </div>

                        <div className="hidden text-left sm:block">
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                                {fullName}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400">
                                {userEmail}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-600 hover:text-white active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <span>🚪</span>
                        <span className="hidden sm:inline">
                            {loggingOut ? "Logging out..." : "Logout"}
                        </span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
                {/* Breadcrumbs */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                        <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-700">
                            <span>🏠</span>
                            <span>Home</span>
                        </Link>
                        <span>/</span>
                        <span className="text-blue-600">Notifications</span>
                    </div>

                    <Link
                        href="/dashboard/bookings/new"
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
                    >
                        <span>+</span>
                        <span>Book a Service</span>
                    </Link>
                </div>

                {/* ========================================================
                    HERO BANNER & TITLE SECTION
                ======================================================== */}
                <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 sm:p-8 shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                        <div className="lg:col-span-8">
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                                Notifications
                            </h1>
                            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-xl leading-relaxed">
                                Stay updated with your bookings, orders, messages and HomeMate announcements.
                            </p>
                        </div>

                        {/* Banner Illustration Graphic */}
                        <div className="lg:col-span-4 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 p-5 border border-amber-200/80 shadow-inner flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-amber-900 leading-tight">Never Miss<br />an Update</p>
                                <p className="mt-1 text-[10px] text-amber-700 max-w-[150px]">
                                    Real-time alerts for a smoother home experience.
                                </p>
                            </div>
                            <div className="text-4xl animate-bounce">
                                🔔
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========================================================
                    4 TOP METRIC CARDS
                ======================================================== */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Notifications */}
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
                            🔔
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Notifications</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{notifications.length}</p>
                            <p className="text-[10px] text-slate-400">All notifications</p>
                        </div>
                    </div>

                    {/* Unread */}
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-rose-50/40 p-5 shadow-sm border-rose-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 text-xl font-bold">
                            ✉️
                        </div>
                        <div>
                            <p className="text-xs font-bold text-rose-500">Unread</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{unreadCount}</p>
                            <p className="text-[10px] text-rose-400 font-medium">Needs your attention</p>
                        </div>
                    </div>

                    {/* Read */}
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-emerald-50/30 p-5 shadow-sm border-emerald-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
                            ✓
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-600">Read</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{readCount}</p>
                            <p className="text-[10px] text-emerald-500 font-medium">Already viewed</p>
                        </div>
                    </div>

                    {/* System Alerts */}
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-purple-50/30 p-5 shadow-sm border-purple-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">
                            📢
                        </div>
                        <div>
                            <p className="text-xs font-bold text-purple-600">System Alerts</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">
                                {notifications.filter((n) => n.type.toLowerCase().includes("system")).length}
                            </p>
                            <p className="text-[10px] text-purple-400 font-medium">Important updates</p>
                        </div>
                    </div>
                </div>

                {/* ========================================================
                    FILTER PILLS & MARK ALL READ ROW
                ======================================================== */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {[
                            { id: "All", label: `All (${notifications.length})` },
                            { id: "Orders", label: `Orders (${notifications.filter((n) => n.type.toLowerCase().includes("order")).length})` },
                            { id: "Maintenance", label: `Maintenance (${notifications.filter((n) => n.type.toLowerCase().includes("maintenance") || n.type.toLowerCase().includes("booking")).length})` },
                            { id: "Messages", label: `Messages (${notifications.filter((n) => n.type.toLowerCase().includes("message")).length})` },
                            { id: "System", label: `System (${notifications.filter((n) => n.type.toLowerCase().includes("system") || n.type.toLowerCase().includes("announcement")).length})` },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveFilter(tab.id)}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                                    activeFilter === tab.id
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            disabled={actionLoading || unreadCount === 0}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm disabled:opacity-40"
                        >
                            <span>✓</span>
                            <span>Mark All as Read</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-40"
                        >
                            <span>↻</span>
                            <span>Filter</span>
                        </button>
                    </div>
                </div>

                {/* ========================================================
                    NOTIFICATIONS LIST
                ======================================================== */}
                {notifications.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                            🔔
                        </div>
                        <h2 className="text-lg font-black text-slate-900">
                            No Notifications
                        </h2>
                        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
                            You're all caught up. New booking, order, message and system notifications will appear here.
                        </p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                            🔍
                        </div>
                        <h2 className="text-lg font-black text-slate-900">
                            No Matching Notifications
                        </h2>
                        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
                            No notifications match the selected "{activeFilter}" filter category.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredNotifications.map((notification) => {
                            const isUnread = !notification.isRead;

                            return (
                                <article
                                    key={notification.$id}
                                    className={`group relative overflow-hidden rounded-3xl border bg-white p-5 sm:p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md ${
                                        isUnread ? "border-blue-200 bg-blue-50/10" : "border-slate-200/80"
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            {/* Unread Status Dot */}
                                            <div className="pt-1.5">
                                                <span
                                                    className={`block h-2.5 w-2.5 rounded-full ${
                                                        isUnread ? "bg-blue-600 animate-pulse" : "bg-transparent"
                                                    }`}
                                                />
                                            </div>

                                            {/* Icon Box */}
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl border border-blue-100">
                                                {getNotificationIcon(notification.type)}
                                            </div>

                                            {/* Text Content */}
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                                                        {notification.title}
                                                    </h2>
                                                    {isUnread && (
                                                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-600 border border-amber-200">
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                                                    {notification.message}
                                                </p>

                                                <p className="text-[10px] font-semibold text-slate-400 pt-1">
                                                    <span className="uppercase tracking-wider font-bold text-slate-500">
                                                        {getNotificationTypeLabel(notification.type)}
                                                    </span>
                                                    {notification.referenceId && (
                                                        <span> • Ref: <span className="font-mono text-slate-500">{notification.referenceId}</span></span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: Timestamp & Actions */}
                                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                                            <span className="text-[11px] font-bold text-slate-400">
                                                {formatDate(notification.$createdAt)}
                                            </span>

                                            <div className="flex items-center gap-2">
                                                {isUnread && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkAsRead(notification)}
                                                        disabled={actionLoading}
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
                                                    >
                                                        ✓ Mark as Read
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(notification.$id)}
                                                    disabled={actionLoading}
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 transition shadow-sm disabled:opacity-50"
                                                    title="Delete Notification"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}