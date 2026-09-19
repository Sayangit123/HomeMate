"use client";

import {
    useEffect,
    useMemo,
    useState,
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
    createMessage,
    getConversation,
    markMessageAsRead,
} from "@/lib/appwrite/message";

import {
    getCurrentUser,
    logoutAccount,
} from "@/lib/appwrite/account";

import {
    getAllMembers,
    getProfileImageUrl,
} from "@/lib/appwrite/member";

import {
    getCurrentMember,
} from "@/lib/appwrite/database";

import {
    createNotification,
} from "@/lib/appwrite/notification";

import {
    useMessageStore,
} from "@/lib/stores/message-store";

import { useAuthStore } from "@/lib/stores/auth-store";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Member {
    $id: string;
    userId: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    role:
    | "customer"
    | "professional"
    | "business";
    profileImage?: string | null;
    profileCompletion: number;
    verificationStatus: string;
    $createdAt?: string;
}

interface Message {
    $id: string;
    senderId: string;
    receiverId: string;
    message: string;
    isRead: boolean;
    $createdAt: string;
}

export default function MessagesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const {
        selectedMemberId,
        searchTerm,
        setSelectedMemberId,
        setSearchTerm,
    } = useMessageStore();

    const [messageText, setMessageText] =
        useState("");

    const [sending, setSending] =
        useState(false);

    // Zustand store sync for user profile
    const storedUser = useAuthStore((state) => state.user);
    const clearUser = useAuthStore((state) => state.clearUser);

    /* ==================================================
       CURRENT USER
    ================================================== */

    const currentUserQuery = useQuery({
        queryKey: [
            "messages",
            "current-user",
        ],
        queryFn: getCurrentUser,
    });

    const currentUserId =
        currentUserQuery.data?.$id || "";

    const currentUserName =
        currentUserQuery.data?.name ||
        "HomeMate User";

    /* ==================================================
       NAVBAR PROFILE & NOTIFICATIONS
    ================================================== */
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

    /* ==================================================
       LOAD MEMBERS (EXCLUDING ADMINS & CURRENT USER)
    ================================================== */

    const membersQuery = useQuery({
        queryKey: [
            "messages",
            "members",
            currentUserId,
        ],

        queryFn: async () => {
            const response =
                await getAllMembers();

            const allMembers =
                response.documents as unknown as Member[];

            return allMembers.filter((member) => {
                if (member.userId === currentUserId) return false;
                const nameLower = member.fullName.toLowerCase();
                // Exclude HomeMate Admin or any admin/support roles
                if (nameLower.includes("admin") || nameLower.includes("support")) {
                    return false;
                }
                return true;
            });
        },

        enabled:
            Boolean(currentUserId),
    });

    const members =
        membersQuery.data || [];

    /* ==================================================
       SELECTED MEMBER
    ================================================== */

    const selectedMember = useMemo(
        () =>
            members.find(
                (member) =>
                    member.userId ===
                    selectedMemberId
            ) || null,

        [
            members,
            selectedMemberId,
        ]
    );

    /* ==================================================
       LOAD CONVERSATION
    ================================================== */

    const conversationQuery = useQuery({
        queryKey: [
            "messages",
            "conversation",
            currentUserId,
            selectedMemberId,
        ],

        queryFn: async () => {
            if (
                !currentUserId ||
                !selectedMemberId
            ) {
                return [] as Message[];
            }

            const response =
                await getConversation(
                    currentUserId,
                    selectedMemberId
                );

            return response.documents as unknown as Message[];
        },

        enabled:
            Boolean(currentUserId) &&
            Boolean(selectedMemberId),
    });

    const messages =
        conversationQuery.data || [];

    /* ==================================================
       MARK UNREAD MESSAGES AS READ
    ================================================== */

    useEffect(() => {
        if (
            !currentUserId ||
            !selectedMemberId
        ) {
            return;
        }

        const unreadMessages =
            messages.filter(
                (item) =>
                    item.receiverId ===
                    currentUserId &&
                    !item.isRead
            );

        if (
            unreadMessages.length === 0
        ) {
            return;
        }

        const markUnreadMessages =
            async () => {
                await Promise.all(
                    unreadMessages.map(
                        async (item) => {
                            try {
                                await markMessageAsRead(
                                    item.$id
                                );
                            } catch (
                            readError
                            ) {
                                console.error(
                                    "Unable to mark message as read:",
                                    readError
                                );
                            }
                        }
                    )
                );

                queryClient.setQueryData<
                    Message[]
                >(
                    [
                        "messages",
                        "conversation",
                        currentUserId,
                        selectedMemberId,
                    ],

                    (previous) =>
                        previous
                            ? previous.map(
                                (item) =>
                                    item.receiverId ===
                                        currentUserId
                                        ? {
                                            ...item,
                                            isRead:
                                                true,
                                        }
                                        : item
                            )
                            : previous
                );
            };

        markUnreadMessages();
    }, [
        currentUserId,
        selectedMemberId,
        messages,
        queryClient,
    ]);

    /* ==================================================
       SEND MESSAGE MUTATION
    ================================================== */

    const sendMessageMutation =
        useMutation({
            mutationFn:
                async (
                    message: string
                ) => {
                    if (!selectedMember) {
                        throw new Error(
                            "Select a contact first."
                        );
                    }

                    const newMessage =
                        await createMessage({
                            senderId:
                                currentUserId,

                            receiverId:
                                selectedMember.userId,

                            message,

                            isRead: false,
                        });

                    const createdMessage =
                        newMessage as unknown as Message;

                    try {
                        await createNotification({
                            userId:
                                selectedMember.userId,

                            title:
                                "New Message",

                            message:
                                `You have received a new message from ${currentUserName || "HomeMate User"}.`,

                            type:
                                "message",

                            isRead:
                                false,

                            referenceId:
                                createdMessage.$id,
                        });
                    } catch (
                    notificationError
                    ) {
                        console.error(
                            "Message notification could not be created:",
                            notificationError
                        );
                    }

                    return createdMessage;
                },

            onSuccess:
                (
                    createdMessage
                ) => {
                    queryClient.setQueryData<
                        Message[]
                    >(
                        [
                            "messages",
                            "conversation",
                            currentUserId,
                            selectedMemberId,
                        ],

                        (
                            previous = []
                        ) => [
                                ...previous,
                                createdMessage,
                            ]
                    );

                    setMessageText("");
                },

            onError:
                async (
                    error
                ) => {
                    console.error(
                        "Send message error:",
                        error
                    );

                    await Swal.fire({
                        icon: "error",

                        title:
                            "Message Not Sent",

                        text:
                            "Something went wrong while sending your message.",

                        confirmButtonColor:
                            "#0f172a",
                    });
                },

            onSettled:
                () => {
                    setSending(false);
                },
        });

    /* ==================================================
       SEND MESSAGE
    ================================================== */

    const sendMessage =
        async () => {
            if (!selectedMember) {
                await Swal.fire({
                    icon: "warning",

                    title:
                        "Select a Contact",

                    text:
                        "Please select a customer, professional or business first.",

                    confirmButtonColor:
                        "#0f172a",
                });

                return;
            }

            const message =
                messageText.trim();

            if (!message) {
                await Swal.fire({
                    icon: "warning",

                    title:
                        "Message Required",

                    text:
                        "Please enter a message before sending.",

                    confirmButtonColor:
                        "#0f172a",
                });

                return;
            }

            try {
                setSending(true);

                await sendMessageMutation.mutateAsync(
                    message
                );
            } catch {
                // Error handled by mutation.
            }
        };

    /* ==================================================
       ENTER KEY
    ================================================== */

    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            if (!sending) {
                sendMessage();
            }
        }
    };

    /* ==================================================
       SELECT CONTACT
    ================================================== */

    const loadConversation =
        (member: Member) => {
            setSelectedMemberId(
                member.userId
            );
        };

    /* ==================================================
       FILTER MEMBERS
    ================================================== */

    const filteredMembers =
        members.filter(
            (member) => {
                const search =
                    searchTerm
                        .trim()
                        .toLowerCase();

                if (!search) {
                    return true;
                }

                return (
                    member.fullName
                        .toLowerCase()
                        .includes(search) ||
                    member.role
                        .toLowerCase()
                        .includes(search) ||
                    member.userId
                        .toLowerCase()
                        .includes(search)
                );
            }
        );

    /* ==================================================
       ROLE LABEL
    ================================================== */

    const getRoleLabel = (
        role: Member["role"]
    ) => {
        if (
            role ===
            "professional"
        ) {
            return "Professional";
        }

        if (
            role === "business"
        ) {
            return "Business";
        }

        return "Customer";
    };

    /* ==================================================
       ROLE ICON
    ================================================== */

    const getRoleIcon = (
        role: Member["role"]
    ) => {
        if (
            role ===
            "professional"
        ) {
            return "🛠️";
        }

        if (
            role === "business"
        ) {
            return "🏢";
        }

        return "👤";
    };

    /* ==================================================
       LOGOUT HANDLER
    ================================================== */
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

    /* ==================================================
       LOADING
    ================================================== */

    const loading =
        currentUserQuery.isLoading ||
        (
            Boolean(
                currentUserId
            ) &&
            membersQuery.isLoading
        );

    const membersLoading =
        Boolean(currentUserId) &&
        membersQuery.isLoading;

    const messagesLoading =
        Boolean(
            selectedMemberId
        ) &&
        conversationQuery.isLoading;

    /* ==================================================
       AUTH ERROR
    ================================================== */

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

    /* ==================================================
       MEMBERS ERROR
    ================================================== */

    if (
        membersQuery.isError
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9]">
                <div className="text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center border border-slate-200 bg-white text-2xl">
                        ⚠️
                    </div>

                    <h2 className="mt-5 text-lg font-bold text-slate-950">
                        Unable to Load Contacts
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Something went wrong while loading HomeMate users.
                    </p>

                </div>
            </main>
        );
    }

    /* ==================================================
       MAIN LOADING
    ================================================== */

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
                <div className="text-center">

                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />

                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                        Loading Messages
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
                        className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
                    >
                        <span className="text-base">💬</span>
                        <span>Messages</span>
                    </Link>
                    <Link
                        href="/dashboard/notifications"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
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
                        className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
                    >
                        <span className="text-base">💬</span>
                        <span>Messages</span>
                    </Link>

                    <Link
                        href="/dashboard/notifications"
                        className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
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
                            A better home<br />for a brighter you
                        </h4>
                        <p className="mt-1 text-[10px] text-slate-400">
                            Connect, communicate, and get things done easily.
                        </p>
                        <Link
                            href="/dashboard/bookings/new"
                            className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
                        >
                            <span>Explore Services</span>
                            <span>→</span>
                        </Link>
                    </div>
                </div>
            </aside>

            {/* Top Navbar (Searchbar removed as requested) */}
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
                        COMMUNICATION PORTAL
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
                            <span>Dashboard</span>
                        </Link>
                        <span>/</span>
                        <span className="text-blue-600">Messages</span>
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
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                COMMUNICATION
                            </span>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                                Messages
                            </h1>
                            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-xl leading-relaxed">
                                Communicate directly with customers, professionals and businesses.
                            </p>
                        </div>

                        {/* Banner Illustration */}
                        <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border border-blue-100">
                            <span className="text-3xl">💬</span>
                            <div>
                                <p className="text-xs font-black text-blue-900">Better Communication</p>
                                <p className="text-[11px] text-blue-600/80 font-medium">Brighter Homes 💙</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========================================================
                    3-COLUMN CHAT INTERFACE
                ======================================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: CONVERSATIONS LIST (4 cols) */}
                    <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col h-[740px]">
                        {/* Conversations Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
                            <h3 className="text-sm font-black text-slate-900">
                                Conversations ({filteredMembers.length})
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    Swal.fire({
                                        title: "New Message",
                                        text: "Select a contact from your list below to start chatting.",
                                        icon: "info",
                                        confirmButtonColor: "#2563eb",
                                    });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition"
                            >
                                <span>+</span>
                                <span>New Message</span>
                            </button>
                        </div>

                        {/* Search Contacts Bar */}
                        <div className="p-3.5 border-b border-slate-100">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-xs">
                                    🔍
                                </span>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search contacts..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Contacts Scrollable List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                            {membersLoading ? (
                                <div className="flex justify-center py-20">
                                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                                </div>
                            ) : filteredMembers.length === 0 ? (
                                <div className="p-10 text-center">
                                    <span className="text-3xl">👥</span>
                                    <p className="mt-2 text-xs font-bold text-slate-800">No Contacts Found</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Try searching with a different keyword.</p>
                                </div>
                            ) : (
                                filteredMembers.map((member) => {
                                    const isSelected = selectedMember?.userId === member.userId;
                                    const imageUrl = getProfileImageUrl(member.profileImage);

                                    return (
                                        <button
                                            key={member.$id}
                                            type="button"
                                            onClick={() => loadConversation(member)}
                                            className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition ${
                                                isSelected ? "bg-blue-50/70 border-l-4 border-blue-600" : "bg-white hover:bg-slate-50/80"
                                            }`}
                                        >
                                            <div className="relative shrink-0">
                                                {imageUrl ? (
                                                    <img
                                                        src={imageUrl}
                                                        alt={member.fullName}
                                                        className="h-11 w-11 rounded-full object-cover border border-slate-200"
                                                    />
                                                ) : (
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-black text-xs text-blue-700 border border-blue-200">
                                                        {member.fullName.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="truncate text-xs font-black text-slate-900">
                                                        {member.fullName}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400">Active</span>
                                                </div>
                                                <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                                                    {getRoleLabel(member.role)}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* CENTER COLUMN: ACTIVE CHAT WINDOW (5 cols) */}
                    <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col h-[740px]">
                        {selectedMember ? (
                            <>
                                {/* Chat Header */}
                                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
                                    <div className="flex items-center gap-3.5">
                                        <div className="relative">
                                            {getProfileImageUrl(selectedMember.profileImage) ? (
                                                <img
                                                    src={getProfileImageUrl(selectedMember.profileImage)!}
                                                    alt={selectedMember.fullName}
                                                    className="h-10 w-10 rounded-full object-cover border border-slate-200"
                                                />
                                            ) : (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-black text-xs text-blue-700">
                                                    {selectedMember.fullName.charAt(0)}
                                                </div>
                                            )}
                                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 leading-tight">
                                                {selectedMember.fullName}
                                            </h3>
                                            <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-0.5">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                                                <span>Online</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                Swal.fire({
                                                    title: `Call ${selectedMember.fullName}`,
                                                    text: `Connecting phone audio to ${selectedMember.phone || "registered number"}...`,
                                                    icon: "info",
                                                    confirmButtonColor: "#2563eb",
                                                });
                                            }}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                                            title="Call"
                                        >
                                            📞
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                Swal.fire({
                                                    title: `Video Call with ${selectedMember.fullName}`,
                                                    text: "Initializing secure video conference stream...",
                                                    icon: "info",
                                                    confirmButtonColor: "#2563eb",
                                                });
                                            }}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                                            title="Video"
                                        >
                                            📹
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => conversationQuery.refetch()}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                                            title="Refresh"
                                        >
                                            ↻
                                        </button>
                                    </div>
                                </div>

                                {/* Messages Stream */}
                                <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-6 space-y-4">
                                    {messagesLoading ? (
                                        <div className="flex h-full items-center justify-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex h-full flex-col items-center justify-center text-center p-6">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600 mb-3">
                                                💬
                                            </div>
                                            <p className="text-xs font-bold text-slate-900">No messages in this conversation yet</p>
                                            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                                                Send a message below to start coordinating with {selectedMember.fullName}.
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map((item) => {
                                            const isMine = item.senderId === currentUserId;

                                            return (
                                                <div
                                                    key={item.$id}
                                                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div
                                                        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                                                            isMine
                                                                ? "bg-blue-600 text-white rounded-br-sm"
                                                                : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-sm"
                                                        }`}
                                                    >
                                                        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                                                            {item.message}
                                                        </p>
                                                        <div className={`mt-1 flex items-center justify-end gap-1.5 text-[9px] ${isMine ? "text-blue-100" : "text-slate-400"}`}>
                                                            <span>
                                                                {item.$createdAt
                                                                    ? new Date(item.$createdAt).toLocaleTimeString("en-IN", {
                                                                          hour: "2-digit",
                                                                          minute: "2-digit",
                                                                      })
                                                                    : ""}
                                                            </span>
                                                            {isMine && <span>{item.isRead ? "✓✓" : "✓"}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Message Input Box */}
                                <div className="border-t border-slate-100 bg-white p-4">
                                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 focus-within:border-blue-500 focus-within:bg-white transition shadow-sm">
                                        <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" title="Attach File">
                                            📎
                                        </button>
                                        <textarea
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            disabled={sending}
                                            rows={1}
                                            placeholder={`Message ${selectedMember.fullName}...`}
                                            className="flex-1 resize-none bg-transparent py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none max-h-24"
                                        />
                                        <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" title="Insert Emoji">
                                            😊
                                        </button>
                                        <button
                                            type="button"
                                            onClick={sendMessage}
                                            disabled={!messageText.trim() || sending}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                            title="Send Message"
                                        >
                                            ➤
                                        </button>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
                                        <span>Press Enter to send • Shift + Enter for new line</span>
                                        <span>{messageText.length}/1000</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-center p-8">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl text-blue-600 mb-3">
                                    💬
                                </div>
                                <h3 className="text-sm font-black text-slate-900">No Chat Selected</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                                    Choose a contact from the left panel to open your conversation and start messaging.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: CONTACT DETAILS & QUICK ACTIONS (3 cols) */}
                    <div className="lg:col-span-3 space-y-6">
                        {selectedMember ? (
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
                                {/* Profile Head */}
                                <div className="text-center border-b border-slate-100 pb-5">
                                    <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-blue-100 bg-blue-50 shadow-sm">
                                        {getProfileImageUrl(selectedMember.profileImage) ? (
                                            <img
                                                src={getProfileImageUrl(selectedMember.profileImage)!}
                                                alt={selectedMember.fullName}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center font-black text-xl text-blue-700">
                                                {selectedMember.fullName.charAt(0)}
                                            </div>
                                        )}
                                        <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                                    </div>

                                    <h3 className="mt-3 text-base font-black text-slate-900">
                                        {selectedMember.fullName}
                                    </h3>
                                    <div className="mt-1.5 flex items-center justify-center gap-1.5">
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-200">
                                            ✓ {getRoleLabel(selectedMember.role)}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-amber-500 font-bold">
                                        ⭐⭐⭐⭐⭐ <span className="text-slate-600 font-semibold">4.8 (120 reviews)</span>
                                    </p>
                                </div>

                                {/* Call / Video / Profile Action Buttons */}
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => Swal.fire({ title: `Calling ${selectedMember.fullName}`, icon: "info" })}
                                        className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/50 p-2.5 hover:bg-white hover:border-blue-300 transition"
                                    >
                                        <span className="text-base">📞</span>
                                        <span className="text-[10px] font-bold text-slate-700 mt-1">Call</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => Swal.fire({ title: `Video Conference with ${selectedMember.fullName}`, icon: "info" })}
                                        className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/50 p-2.5 hover:bg-white hover:border-blue-300 transition"
                                    >
                                        <span className="text-base">📹</span>
                                        <span className="text-[10px] font-bold text-slate-700 mt-1">Video</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push("/dashboard/professionals")}
                                        className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/50 p-2.5 hover:bg-white hover:border-blue-300 transition"
                                    >
                                        <span className="text-base">👤</span>
                                        <span className="text-[10px] font-bold text-slate-700 mt-1">Profile</span>
                                    </button>
                                </div>

                                {/* About Section */}
                                <div className="space-y-3 border-t border-slate-100 pt-4 text-xs">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">About</p>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Verified HomeMate {getRoleLabel(selectedMember.role).toLowerCase()} providing reliable maintenance and home services.
                                    </p>

                                    <div className="space-y-2 pt-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400">Role</span>
                                            <span className="font-bold text-slate-800">{getRoleLabel(selectedMember.role)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400">Phone</span>
                                            <span className="font-bold text-slate-800">{selectedMember.phone || "+91 98765 43210"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400">Location</span>
                                            <span className="font-bold text-slate-800">Kolkata, West Bengal</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400">Member since</span>
                                            <span className="font-bold text-slate-800">
                                                {selectedMember.$createdAt ? new Date(selectedMember.$createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Jan 2024"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
                                <span className="text-3xl">👤</span>
                                <h4 className="text-xs font-bold text-slate-800 mt-2">Contact Profile</h4>
                                <p className="text-[11px] text-slate-400 mt-1">Select a chat to view user details and quick actions.</p>
                            </div>
                        )}

                        {/* Quick Actions Widget */}
                        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-3">
                            <h4 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">
                                Quick Actions
                            </h4>
                            <div className="space-y-2">
                                <Link
                                    href="/dashboard/service-history"
                                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition"
                                >
                                    <span>View Previous Services</span>
                                    <span>→</span>
                                </Link>
                                <Link
                                    href="/dashboard/bookings/new"
                                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition"
                                >
                                    <span>Book a Service</span>
                                    <span>→</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => Swal.fire({ title: "Report Submitted", text: "Our support team will review your report shortly.", icon: "success" })}
                                    className="flex w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 px-3.5 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                                >
                                    <span>Report an Issue</span>
                                    <span>!</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}