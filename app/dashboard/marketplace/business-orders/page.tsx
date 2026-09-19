"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Account, Databases, Query } from "appwrite";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";

import client from "@/lib/appwrite/client";
import { updateOrderStatus } from "@/lib/appwrite/order";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";
import { useAuthStore } from "@/lib/stores/auth-store";

const account = new Account(client);
const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const PRODUCTS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_PRODUCTS_TABLE_ID || "products";
const ORDER_ITEMS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_ORDER_ITEMS_TABLE_ID || "orderItems";
const ORDERS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_ORDERS_TABLE_ID || "orders";
const MEMBERS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID || "members";
const NOTIFICATIONS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

type OrderStatus =
    | "Pending"
    | "Confirmed"
    | "Processing"
    | "Shipped"
    | "Delivered"
    | "Cancelled";

interface Product {
    $id: string;
    productName: string;
    price: number;
    image?: string | null;
    businessId: string;
}

interface OrderItem {
    $id: string;
    orderId: string;
    productId: string;
    productName: string;
    productImage?: string | null;
    price: number;
    quantity: number;
}

interface Order {
    $id: string;
    customerId: string;
    totalAmount: number;
    status: OrderStatus;
    shippingAddress: string;
    paymentStatus: string;
    $createdAt: string;
}

interface Customer {
    fullName: string;
    phone?: string | null;
}

interface BusinessOrder {
    order: Order;
    items: OrderItem[];
    customer: Customer | null;
}

const STATUS_OPTIONS: OrderStatus[] = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
];

const getStatusClass = (status: OrderStatus) => {
    switch (status) {
        case "Pending":
            return "bg-amber-50 text-amber-700 border-amber-200";
        case "Confirmed":
            return "bg-blue-50 text-blue-700 border-blue-200";
        case "Processing":
            return "bg-indigo-50 text-indigo-700 border-indigo-200";
        case "Shipped":
            return "bg-purple-50 text-purple-700 border-purple-200";
        case "Delivered":
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "Cancelled":
            return "bg-red-50 text-red-700 border-red-200";
        default:
            return "bg-slate-50 text-slate-700 border-slate-200";
    }
};

const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function BusinessOrdersPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [businessOrders, setBusinessOrders] = useState<BusinessOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<"All" | OrderStatus>("All");

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [navbarSearch, setNavbarSearch] = useState("");

    const storedUser = useAuthStore((state) => state.user);
    const clearUser = useAuthStore((state) => state.clearUser);

    /* Navbar Profile Data */
    const { data: userData } = useQuery({
        queryKey: ["user", "navbar-profile"],
        queryFn: async () => {
            const currentUser = await account.get();
            if (!currentUser) return null;
            const member = await getCurrentMember(currentUser.$id);

            let resolvedImgUrl: string | null = null;
            if (member?.profileImage) {
                try {
                    resolvedImgUrl = getProfileImageUrl(member.profileImage).toString();
                } catch {
                    resolvedImgUrl = member.profileImage;
                }
            }

            return {
                id: currentUser.$id,
                name: member?.fullName?.trim() || currentUser.name?.trim() || "Sonu Bhoumik",
                email: currentUser.email || "",
                role: member?.role || "business",
                profileImage: resolvedImgUrl,
            };
        },
        staleTime: 60 * 1000,
    });

    const activeUserId = userData?.id || storedUser?.userId;

    const { data: unreadNotificationsCount = 0 } = useQuery({
        queryKey: ["notifications", "unread-count", activeUserId],
        queryFn: async () => {
            if (!activeUserId) return 0;
            try {
                const res = await databases.listDocuments(
                    DATABASE_ID,
                    NOTIFICATIONS_TABLE_ID,
                    [Query.equal("userId", activeUserId), Query.equal("isRead", false)]
                );
                return res.total ?? res.documents.length;
            } catch {
                return 0;
            }
        },
        enabled: !!activeUserId,
        refetchInterval: 15000,
    });

    const userName = userData?.name || storedUser?.fullName || "Sonu Bhoumik";
    const userEmail = userData?.email || storedUser?.email || "sonu@gmail.com";
    const userProfileImage = userData?.profileImage || storedUser?.profileImage;

    const initials = useMemo(() => {
        return (
            userName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p: string) => p.charAt(0).toUpperCase())
                .join("") || "SB"
        );
    }, [userName]);

    const loadBusinessOrders = async () => {
        try {
            setLoading(true);
            const currentUser = await account.get();

            const memberResponse = await databases.listDocuments(
                DATABASE_ID,
                MEMBERS_TABLE_ID,
                [Query.equal("userId", currentUser.$id), Query.limit(1)]
            );

            if (memberResponse.documents.length === 0) {
                throw new Error("Business profile not found.");
            }

            const member = memberResponse.documents[0] as unknown as { role: string };
            if (member.role !== "business") {
                throw new Error("Only business users can access this page.");
            }

            const productsResponse = await databases.listDocuments(
                DATABASE_ID,
                PRODUCTS_TABLE_ID,
                [Query.equal("businessId", currentUser.$id), Query.limit(100)]
            );

            const products = productsResponse.documents as unknown as Product[];
            if (products.length === 0) {
                setBusinessOrders([]);
                return;
            }

            const orderItemsMap = new Map<string, OrderItem[]>();

            await Promise.all(
                products.map(async (product) => {
                    try {
                        const itemResponse = await databases.listDocuments(
                            DATABASE_ID,
                            ORDER_ITEMS_TABLE_ID,
                            [Query.equal("productId", product.$id), Query.limit(100)]
                        );

                        const items = itemResponse.documents as unknown as OrderItem[];
                        items.forEach((item) => {
                            const existingItems = orderItemsMap.get(item.orderId) || [];
                            existingItems.push(item);
                            orderItemsMap.set(item.orderId, existingItems);
                        });
                    } catch (error) {
                        console.error(`Unable to load order items for product ${product.$id}:`, error);
                    }
                })
            );

            const orderIds = Array.from(orderItemsMap.keys());
            if (orderIds.length === 0) {
                setBusinessOrders([]);
                return;
            }

            const ordersResponse = await Promise.all(
                orderIds.map(async (orderId) => {
                    try {
                        const response = await databases.getDocument(
                            DATABASE_ID,
                            ORDERS_TABLE_ID,
                            orderId
                        );
                        return response as unknown as Order;
                    } catch (error) {
                        console.error(`Unable to load order ${orderId}:`, error);
                        return null;
                    }
                })
            );

            const validOrders = ordersResponse.filter((order): order is Order => order !== null);
            const customerCache = new Map<string, Customer | null>();

            const finalOrders = await Promise.all(
                validOrders.map(async (order): Promise<BusinessOrder> => {
                    let customer = customerCache.get(order.customerId);

                    if (customer === undefined) {
                        try {
                            const customerResponse = await databases.listDocuments(
                                DATABASE_ID,
                                MEMBERS_TABLE_ID,
                                [Query.equal("userId", order.customerId), Query.limit(1)]
                            );

                            if (customerResponse.documents.length > 0) {
                                const customerDocument = customerResponse.documents[0] as unknown as {
                                    fullName?: string;
                                    phone?: string;
                                };

                                customer = {
                                    fullName: customerDocument.fullName || "Customer",
                                    phone: customerDocument.phone || null,
                                };
                            } else {
                                customer = null;
                            }
                        } catch (error) {
                            console.error("Customer fetch failed:", error);
                            customer = null;
                        }
                        customerCache.set(order.customerId, customer);
                    }

                    return {
                        order,
                        items: orderItemsMap.get(order.$id) || [],
                        customer: customer || null,
                    };
                })
            );

            finalOrders.sort(
                (a, b) => new Date(b.order.$createdAt).getTime() - new Date(a.order.$createdAt).getTime()
            );

            setBusinessOrders(finalOrders);
        } catch (error) {
            console.error("Business orders loading error:", error);
            Swal.fire({
                icon: "error",
                title: "Unable to Load Orders",
                text: error instanceof Error ? error.message : "Something went wrong while loading business orders.",
                confirmButtonColor: "#0f172a",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBusinessOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        let list = businessOrders;
        if (filterStatus !== "All") {
            list = list.filter(({ order }) => order.status === filterStatus);
        }
        if (navbarSearch.trim()) {
            const q = navbarSearch.toLowerCase();
            list = list.filter(({ order, customer }) => {
                return (
                    order.$id.toLowerCase().includes(q) ||
                    customer?.fullName?.toLowerCase().includes(q) ||
                    order.shippingAddress.toLowerCase().includes(q)
                );
            });
        }
        return list;
    }, [businessOrders, filterStatus, navbarSearch]);

    const statistics = useMemo(() => {
        return {
            total: businessOrders.length,
            pending: businessOrders.filter(({ order }) => order.status === "Pending").length,
            processing: businessOrders.filter(({ order }) => order.status === "Confirmed" || order.status === "Processing").length,
            shipped: businessOrders.filter(({ order }) => order.status === "Shipped").length,
            delivered: businessOrders.filter(({ order }) => order.status === "Delivered").length,
        };
    }, [businessOrders]);

    const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
        if (order.status === newStatus) return;

        const confirmation = await Swal.fire({
            icon: newStatus === "Cancelled" ? "warning" : "question",
            title: newStatus === "Cancelled" ? "Cancel this order?" : "Update order status?",
            html: `
                <div style="text-align:center">
                    <p style="margin-bottom:8px">Order: <strong>#${order.$id.slice(-8)}</strong></p>
                    <p>Change status from <strong>${order.status}</strong> to <strong>${newStatus}</strong></p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Yes, Update",
            cancelButtonText: "Keep Current",
            confirmButtonColor: "#0f172a",
            cancelButtonColor: "#64748b",
        });

        if (!confirmation.isConfirmed) return;

        try {
            setUpdatingOrderId(order.$id);
            await updateOrderStatus(order.$id, newStatus);

            try {
                await fetch("/api/notifications/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        customerId: order.customerId,
                        orderId: order.$id,
                        status: newStatus,
                    }),
                });
            } catch (notificationError) {
                console.error("Order notification error:", notificationError);
            }

            setBusinessOrders((previousOrders) =>
                previousOrders.map((businessOrder) =>
                    businessOrder.order.$id === order.$id
                        ? { ...businessOrder, order: { ...businessOrder.order, status: newStatus } }
                        : businessOrder
                )
            );

            await Swal.fire({
                icon: "success",
                title: "Status Updated",
                text: `Order status changed to ${newStatus}.`,
                confirmButtonColor: "#0f172a",
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Order status update error:", error);
            Swal.fire({
                icon: "error",
                title: "Update Failed",
                text: error instanceof Error ? error.message : "Unable to update the order status.",
                confirmButtonColor: "#0f172a",
            });
        } finally {
            setUpdatingOrderId(null);
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
            await account.deleteSession("current");
            clearUser();

            ["token", "accessToken", "authToken", "user", "userData", "role", "userRole"].forEach((key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });

            window.location.href = "/login";
        } catch (err) {
            console.error("Logout error:", err);
            clearUser();
            setLoggingOut(false);
            window.location.href = "/login";
        }
    };

    if (!mounted || loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                        Loading Customer Orders...
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
                    <Link href="/dashboard/marketplace" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
                        <span>🛒</span><span>Marketplace</span>
                    </Link>
                    <Link href="/dashboard/marketplace/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md">
                        <span>📦</span><span>Customer Orders</span>
                    </Link>
                    <Link href="/dashboard/properties" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
                        <span>🏘️</span><span>My Properties</span>
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
                    <Link href="/dashboard/marketplace" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                        <span>🛒</span><span>Marketplace</span>
                    </Link>
                    <Link href="/dashboard/marketplace/orders" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30">
                        <span>📦</span><span>Customer Orders</span>
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
                            📦
                        </div>
                        <h4 className="text-xs font-black text-white leading-tight">
                            Grow Your Business<br />with HomeMate
                        </h4>
                        <p className="mt-1 text-[10px] text-slate-400">
                            List products and reach more customers.
                        </p>
                        <Link
                            href="/dashboard/marketplace"
                            className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
                        >
                            <span>Marketplace</span>
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
                            placeholder="Search orders, customers, products..."
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
                                <img src={userProfileImage} alt={userName} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center font-black text-xs text-blue-600 bg-blue-100">
                                    {initials}
                                </div>
                            )}
                        </div>

                        <div className="hidden text-left sm:block">
                            <p className="text-xs font-bold text-slate-900 leading-tight">{userName}</p>
                            <p className="text-[10px] font-medium text-slate-400">Business Owner</p>
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

            {/* Main Content Area */}
            <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                        <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-700">
                            <span>🏠</span>
                            <span>Home</span>
                        </Link>
                        <span>/</span>
                        <Link href="/dashboard/marketplace" className="hover:text-slate-700">Marketplace</Link>
                        <span>/</span>
                        <span className="text-blue-600">Customer Orders</span>
                    </div>

                    <button
                        type="button"
                        onClick={loadBusinessOrders}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
                    >
                        <span>↻</span>
                        <span>{loading ? "Refreshing..." : "Refresh Orders"}</span>
                    </button>
                </div>

                {/* Hero Banner Card */}
                <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-100/40 p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="max-w-xl">
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
                                BUSINESS FULFILLMENT
                            </span>
                            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                                Customer Orders
                            </h1>
                            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Manage orders received for your products and keep customers updated throughout the delivery process.
                            </p>
                        </div>

                        <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                                📦
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-900">Delivering Happiness</p>
                                <p className="text-[11px] text-slate-500">Track, manage and fulfill orders with ease.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5 TOP METRIC CARDS */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
                            🛍️
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400">Total Orders</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{statistics.total}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">↑ Active volume</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-amber-50/40 p-5 shadow-sm border-amber-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
                            ⏳
                        </div>
                        <div>
                            <p className="text-xs font-bold text-amber-600">Pending</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{statistics.pending}</p>
                            <p className="text-[10px] text-amber-500 font-medium">Needs attention</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-blue-50/40 p-5 shadow-sm border-blue-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
                            ⚙️
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600">Processing</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{statistics.processing}</p>
                            <p className="text-[10px] text-blue-500 font-medium">Being prepared</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-purple-50/40 p-5 shadow-sm border-purple-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">
                            🚚
                        </div>
                        <div>
                            <p className="text-xs font-bold text-purple-600">Shipped</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{statistics.shipped}</p>
                            <p className="text-[10px] text-purple-500 font-medium">On the way</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-emerald-50/40 p-5 shadow-sm border-emerald-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
                            ✓
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-600">Delivered</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{statistics.delivered}</p>
                            <p className="text-[10px] text-emerald-500 font-medium">Successfully completed</p>
                        </div>
                    </div>
                </div>

                {/* FILTER PILLS & SEARCH BAR */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-black text-slate-900">Orders ({filteredOrders.length})</h2>
                            <p className="text-xs text-slate-500 mt-0.5">View and manage all customer orders</p>
                        </div>

                        <div className="relative flex-1 max-w-sm">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">
                                🔍
                            </span>
                            <input
                                type="text"
                                placeholder="Search by order ID, customer name..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setFilterStatus("All")}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                                filterStatus === "All"
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                        >
                            All ({businessOrders.length})
                        </button>

                        {STATUS_OPTIONS.map((status) => {
                            const count = businessOrders.filter(({ order }) => order.status === status).length;
                            return (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setFilterStatus(status)}
                                    className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                                        filterStatus === status
                                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                            : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                                    }`}
                                >
                                    {status} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ORDERS LIST */}
                {filteredOrders.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                            📦
                        </div>
                        <h3 className="text-lg font-black text-slate-900">No Orders Found</h3>
                        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
                            {filterStatus === "All"
                                ? "Customers have not placed any orders for your products yet."
                                : `There are currently no ${filterStatus.toLowerCase()} orders.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map(({ order, items, customer }) => {
                            const isExpanded = expandedOrderId === order.$id;
                            const businessSubtotal = items.reduce(
                                (total, item) => total + item.price * item.quantity,
                                0
                            );

                            return (
                                <article
                                    key={order.$id}
                                    className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:border-blue-300"
                                >
                                    {/* Order Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-base font-black text-slate-900">
                                                    Order #{order.$id.slice(-8)}
                                                </h3>
                                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${getStatusClass(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Placed on {formatDateTime(order.$createdAt)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-left md:text-right">
                                                <p className="text-[10px] font-bold uppercase text-slate-400">Total Amount</p>
                                                <p className="text-lg font-black text-slate-900">
                                                    ₹{businessSubtotal.toLocaleString("en-IN")}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setExpandedOrderId(isExpanded ? null : order.$id)}
                                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                                            >
                                                {isExpanded ? "Hide Details" : "View Details"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Customer & Shipping Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 text-xs">
                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Customer</p>
                                            <p className="font-bold text-slate-800 mt-0.5">{customer?.fullName || "Customer"}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">{customer?.phone || "No phone provided"}</p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Payment</p>
                                            <p className="font-bold text-slate-800 mt-0.5">{order.paymentStatus}</p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400">Shipping Address</p>
                                            <p className="font-semibold text-slate-700 mt-0.5 line-clamp-1">{order.shippingAddress}</p>
                                        </div>
                                    </div>

                                    {/* Expanded Order Items & Status Selector */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 pt-5 mt-2 space-y-6">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                                                    Ordered Products ({items.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {items.map((item) => (
                                                        <div key={item.$id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-xs">
                                                                    📦
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-900">{item.productName}</p>
                                                                    <p className="text-[11px] text-slate-500">Qty: {item.quantity} × ₹{item.price.toLocaleString("en-IN")}</p>
                                                                </div>
                                                            </div>
                                                            <p className="font-black text-slate-900">
                                                                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Status Update Control */}
                                            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">Update Order Status</p>
                                                    <p className="text-[11px] text-slate-500">Change status to keep customer informed.</p>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <select
                                                        value={order.status}
                                                        disabled={updatingOrderId === order.$id}
                                                        onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                                                    >
                                                        {STATUS_OPTIONS.map((status) => (
                                                            <option key={status} value={status}>
                                                                {status}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {updatingOrderId === order.$id && (
                                                        <span className="text-xs font-bold text-blue-600 animate-pulse">Updating...</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}