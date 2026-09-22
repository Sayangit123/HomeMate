"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";
import { useAuthStore } from "@/lib/stores/auth-store";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";
const PRODUCTS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_PRODUCTS_TABLE_ID || "products";

interface Product {
  $id: string;
  userId: string;
  productName: string;
  category?: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  status?: string;
  $createdAt?: string;
}

export default function MyProductsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [navbarSearch, setNavbarSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedStockStatus, setSelectedStockStatus] = useState("Stock Status");
  const [sortBy, setSortBy] = useState("Newest");

  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  /* Navbar Profile Data */
  const { data: userData } = useQuery({
    queryKey: ["user", "navbar-profile"],
    queryFn: async () => {
      const currentUser = await getCurrentUser();
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
        name: member?.fullName?.trim() || currentUser.name?.trim() || "Rahul Sharma",
        email: currentUser.email || "",
        role: member?.role || "admin",
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
          [AppwriteQuery.equal("userId", activeUserId), AppwriteQuery.equal("isRead", false)]
        );
        return res.total ?? res.documents.length;
      } catch {
        return 0;
      }
    },
    enabled: !!activeUserId,
    refetchInterval: 15000,
  });

  const userName = userData?.name || storedUser?.fullName || "Rahul Sharma";
  const userEmail = userData?.email || storedUser?.email || "rahul@gmail.com";
  const userProfileImage = userData?.profileImage || storedUser?.profileImage;

  const initials = useMemo(() => {
    return (
      userName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p.charAt(0).toUpperCase())
        .join("") || "RS"
    );
  }, [userName]);

  /* Fetch Products */
  const loadProducts = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const response = await databases.listDocuments(
        DATABASE_ID,
        PRODUCTS_TABLE_ID,
        [AppwriteQuery.equal("businessId", currentUser.$id)]
      );

      setProducts(response.documents as unknown as Product[]);
    } catch (error) {
      console.error("Load products error:", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to Load Products",
        text: "Something went wrong while loading your products.",
        confirmButtonColor: "#0f172a",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (product: Product) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Product?",
      text: `Are you sure you want to delete "${product.productName}"? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(product.$id);
      await databases.deleteDocument(DATABASE_ID, PRODUCTS_TABLE_ID, product.$id);

      setProducts((current) => current.filter((p) => p.$id !== product.$id));

      await Swal.fire({
        icon: "success",
        title: "Product Deleted",
        text: "Your product has been successfully deleted.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Delete product error:", error);
      await Swal.fire({
        icon: "error",
        title: "Unable to Delete",
        text: "Something went wrong while deleting the product.",
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

  const inStockCount = products.filter((p) => (p.stock ?? 1) > 0).length;
  const outOfStockCount = products.filter((p) => (p.stock ?? 1) <= 0).length;

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = productSearch === "" || p.productName.toLowerCase().includes(productSearch.toLowerCase());
      const matchesCategory = selectedCategory === "All Categories" || p.category === selectedCategory;
      const matchesStock =
        selectedStockStatus === "Stock Status" ||
        (selectedStockStatus === "In Stock" && (p.stock ?? 1) > 0) ||
        (selectedStockStatus === "Out of Stock" && (p.stock ?? 1) <= 0);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, productSearch, selectedCategory, selectedStockStatus]);

  if (!mounted) return null;

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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0b1a2e] text-white transition-transform duration-300 ease-in-out lg:hidden ${mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
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
          <Link href="/dashboard/marketplace/products" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md">
            <span>📦</span><span>My Products</span>
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
          <Link href="/dashboard/marketplace/products" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30">
            <span>📦</span><span>My Products</span>
          </Link>
          <Link href="/dashboard/marketplace/orders" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span>🛍️</span><span>Orders</span>
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
              🏪
            </div>
            <h4 className="text-xs font-black text-white leading-tight">
              Grow Your Business<br />with HomeMate
            </h4>
            <p className="mt-1 text-[10px] text-slate-400">
              Reach more customers and increase your sales.
            </p>
            <Link
              href="/dashboard/marketplace"
              className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <span>Upgrade Plan</span>
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
              placeholder="Search products, categories, or brands..."
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
              <p className="text-[10px] font-medium text-slate-400">Admin</p>
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
            <Link href="/dashboard/marketplace" className="hover:text-slate-700">Marketplace</Link>
            <span>/</span>
            <span className="text-blue-600">My Products</span>
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
                HOMEMATE MARKETPLACE
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                My Products
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Manage the products your business offers through the HomeMate marketplace.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-black text-slate-900">List, Manage, Grow</span>
                <span className="text-[11px] text-slate-500">Expand your reach on HomeMate</span>
              </div>
              <Link
                href="/dashboard/marketplace/products/add"
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
              >
                <span>+</span>
                <span>Add Product</span>
              </Link>
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
              <p className="text-xs font-bold text-slate-400">Total Products</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{products.length}</p>
              <p className="text-[10px] text-slate-400">All products listed</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-emerald-50/40 p-5 shadow-sm border-emerald-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600">In Stock</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{inStockCount}</p>
              <p className="text-[10px] text-emerald-500 font-medium">Available for purchase</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-rose-50/40 p-5 shadow-sm border-rose-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 text-xl font-bold">
              ✕
            </div>
            <div>
              <p className="text-xs font-bold text-rose-600">Out of Stock</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{outOfStockCount}</p>
              <p className="text-[10px] text-rose-400 font-medium">Currently unavailable</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 text-xl font-bold">
              👁️
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Total Views</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{products.length * 12}</p>
              <p className="text-[10px] text-slate-400">Product page views</p>
            </div>
          </div>
        </div>

        {/* FILTER & SEARCH ROW */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="relative lg:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
            >
              <option value="All Categories">All Categories</option>
              <option value="Home Tools">Home Tools</option>
              <option value="Decor">Decor</option>
              <option value="Electronics">Electronics</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStockStatus}
              onChange={(e) => setSelectedStockStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
            >
              <option value="Stock Status">Stock Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
            >
              <option value="Newest">Sort by: Newest</option>
              <option value="Price Low">Price: Low to High</option>
              <option value="Price High">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* PRODUCTS LIST */}
        <section className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border bg-white p-16 text-center shadow-sm">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="mt-3 text-xs font-bold text-slate-400">Loading your products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
              <span className="text-4xl">📦</span>
              <h3 className="text-base font-bold text-slate-900 mt-3">No Products Found</h3>
              <p className="text-xs text-slate-400 mt-1">Try changing your search query or filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => {
                const inStock = (product.stock ?? 1) > 0;

                return (
                  <article
                    key={product.$id}
                    className="flex flex-col md:flex-row items-stretch rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-blue-300 transition gap-6"
                  >
                    {/* Product Image & Badge */}
                    <div className="relative h-48 w-full md:w-56 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-100">
                      {product.image ? (
                        <img src={product.image} alt={product.productName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-400 bg-slate-50">
                          📦
                        </div>
                      )}
                      <span
                        className={`absolute top-3 left-3 rounded-full px-3 py-1 text-[10px] font-bold shadow-sm ${inStock ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                          }`}
                      >
                        {inStock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    {/* Product Main Details */}
                    <div className="flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                              {product.category || "HOME TOOLS"}
                            </span>
                            <h2 className="text-lg font-black text-slate-900 mt-0.5">{product.productName}</h2>
                          </div>
                        </div>

                        <p className="text-xl font-black text-slate-900 mt-2">
                          ₹{Number(product.price || 0).toLocaleString("en-IN")}
                        </p>

                        <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-amber-500">
                          <span>★</span>
                          <span>4.5</span>
                          <span className="text-slate-400 font-normal">(24 reviews)</span>
                        </div>

                        <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                          {product.description || "High quality home product designed with durability and premium finish."}
                        </p>
                      </div>

                      {/* Tag pills */}
                      <div className="flex flex-wrap gap-2">
                        {["Quality Assured", "Fast Shipping", "Durable"].map((tag) => (
                          <span key={tag} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right Side Stats & Actions */}
                    <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-w w-full md:w-64 gap-4">
                      <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Stock</p>
                          <p className="text-xs font-black text-slate-900 mt-0.5">{product.stock ?? 1} units</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Category</p>
                          <p className="text-xs font-black text-slate-900 mt-0.5">{product.category || "Home Tools"}</p>
                        </div>
                        <div className="col-span-2 md:col-span-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Added On</p>
                          <p className="text-xs font-black text-slate-900 mt-0.5">
                            {product.$createdAt ? new Date(product.$createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "17 Sep 2026"}
                          </p>
                        </div>
                      </div>

                      {/* Edit, View, Delete Actions */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/marketplace/products/${product.$id}/edit`}
                          className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/dashboard/marketplace/${product.$id}`}
                          className="flex-1 rounded-xl border border-blue-200 bg-blue-50 py-2 text-center text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          disabled={deletingId === product.$id}
                          className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-2 text-center text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-sm disabled:opacity-50"
                        >
                          {deletingId === product.$id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-400">Showing {filteredProducts.length} of {products.length} products</p>
          <div className="flex items-center gap-2">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50">←</button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm">1</button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50">→</button>
          </div>
        </div>
      </main>
    </div>
  );
}