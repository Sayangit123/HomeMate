"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getAllProducts } from "@/lib/appwrite/product";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";
import {
  createCartItem,
  getCustomerCart,
  getCartItemByProduct,
  updateCartItem,
} from "@/lib/appwrite/cart";
import { useMarketplaceStore } from "@/lib/stores/marketplace-store";
import { useAuthStore } from "@/lib/stores/auth-store";

/* ============================================================
   APPWRITE CONFIG
============================================================ */

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Product {
  $id: string;
  businessId: string;
  productName: string;
  description?: string | null;
  category: string;
  price: number;
  stock: number;
  image?: string | null;
  $createdAt?: string;
}

const categories = [
  "All Categories",
  "Cleaning Products",
  "Electrical Accessories",
  "Plumbing Supplies",
  "Home Tools",
  "Smart Home Products",
  "Maintenance Equipment",
];

export default function MarketplacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // Zustand Stores
  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  const {
    searchTerm,
    selectedCategory,
    sortBy,
    setSearchTerm,
    setSelectedCategory,
    setSortBy,
    clearFilters,
  } = useMarketplaceStore();

  /* ==========================================================
     TANSTACK QUERY: NAVBAR PROFILE DATA
  ========================================================== */
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
        name: member?.fullName?.trim() || currentUser.name?.trim() || "User",
        email: currentUser.email || "",
        role: member?.role || "customer",
        profileImage: resolvedImgUrl,
      };
    },
    staleTime: 60 * 1000,
  });

  const activeUserId = userData?.id || storedUser?.userId;

  /* ==========================================================
     TANSTACK QUERY: LIVE CART BADGE COUNTER FROM APPWRITE
  ========================================================== */
  const { data: cartCount = 0 } = useQuery({
    queryKey: ["marketplace-cart-count", activeUserId],
    queryFn: async () => {
      if (!activeUserId) return 0;
      try {
        const res = await getCustomerCart(activeUserId);
        const docs = res.documents || [];
        return docs.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 1), 0);
      } catch {
        return 0;
      }
    },
    enabled: !!activeUserId,
    refetchInterval: 10000,
  });

  /* ==========================================================
     TANSTACK QUERY: LIVE UNREAD NOTIFICATIONS COUNT
  ========================================================== */
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

  const userName = userData?.name || storedUser?.fullName || "Sonu Bhoumik";
  const userEmail = userData?.email || storedUser?.email || "sonu@gmail.com";
  const userProfileImage = userData?.profileImage || storedUser?.profileImage;

  const initials = useMemo(() => {
    return (
      userName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("") || "SB"
    );
  }, [userName]);

  /* ==========================================================
     TANSTACK QUERY: FETCH PRODUCTS
  ========================================================== */
  const {
    data: products = [],
    isLoading: loading,
  } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: async (): Promise<Product[]> => {
      try {
        const response = await getAllProducts();
        return response.documents as unknown as Product[];
      } catch (error) {
        console.error("Load marketplace products error:", error);
        await Swal.fire({
          icon: "error",
          title: "Unable to Load Marketplace",
          text: "Something went wrong while loading the products.",
          confirmButtonColor: "#0f172a",
        });
        throw error;
      }
    },
    staleTime: 30 * 1000,
  });

  /* ==========================================================
     TANSTACK MUTATION: ADD TO CART (APPWRITE BACKEND)
  ========================================================== */
  const addToCartMutation = useMutation({
    mutationFn: async (product: Product) => {
      const user = await getCurrentUser();
      if (!user) throw new Error("Please log in to add items to your cart.");

      // Check if product already exists in cart
      const existingItem = await getCartItemByProduct(user.$id, product.$id);

      if (existingItem) {
        const currentQty = Number(existingItem.quantity) || 0;
        const availableStock = Number(product.stock) || 0;

        if (availableStock <= 0) {
          throw new Error("This product is currently out of stock.");
        }

        if (currentQty >= availableStock) {
          throw new Error(
            `Only ${availableStock} item${availableStock === 1 ? "" : "s"} available in stock.`
          );
        }

        const newQty = currentQty + 1;

        return await updateCartItem(existingItem.$id, {
          quantity: newQty,
        });
      }

      // If new, create document in Appwrite collection
      // If new, create document in Appwrite collection
      const availableStock = Number(product.stock) || 0;

      if (availableStock <= 0) {
        throw new Error("This product is currently out of stock.");
      }

      return await createCartItem({
        customerId: user.$id,
        productId: product.$id,
        quantity: 1,
      });
    },
    onSuccess: async (_, product) => {
      // Invalidate queries so cart page and counter update instantly
      await queryClient.invalidateQueries({ queryKey: ["marketplace-cart"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-cart-count"] });

      await Swal.fire({
        icon: "success",
        title: "Added to Cart",
        text: `${product.productName} has been added to your cart.`,
        timer: 1400,
        showConfirmButton: false,
      });
    },
    onError: (err: any) => {
      console.error("Add to cart error:", err);
      Swal.fire({
        icon: "error",
        title: "Cart Error",
        text: err?.message || "Could not add item to cart. Please try again.",
      });
    },
  });

  const handleAddToCart = (product: Product) => {
    addToCartMutation.mutate(product);
  };

  /* ==========================================================
     FILTER & SORT PRODUCTS
  ========================================================== */
  const filteredProducts = useMemo(() => {
    let result = [...products];
    const search = searchTerm.trim().toLowerCase();

    if (search) {
      result = result.filter((product) => {
        const productName = product.productName?.toLowerCase() || "";
        const description = product.description?.toLowerCase() || "";
        const category = product.category?.toLowerCase() || "";

        return (
          productName.includes(search) ||
          description.includes(search) ||
          category.includes(search)
        );
      });
    }

    if (selectedCategory !== "All Categories") {
      result = result.filter(
        (product) => product.category === selectedCategory
      );
    }

    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "newest") {
      result.sort((a, b) => {
        const dateA = a.$createdAt ? new Date(a.$createdAt).getTime() : 0;
        const dateB = b.$createdAt ? new Date(b.$createdAt).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === "stock") {
      result.sort((a, b) => {
        if (a.stock > 0 && b.stock === 0) return -1;
        if (a.stock === 0 && b.stock > 0) return 1;
        return b.stock - a.stock;
      });
    }

    return result;
  }, [products, searchTerm, selectedCategory, sortBy]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedCategory !== "All Categories" ||
    sortBy !== "newest";

  /* ==========================================================
     LOGOUT HANDLER
  ========================================================== */
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
    } catch (err) {
      console.error("Logout error:", err);
      clearUser();
      setLoggingOut(false);
      window.location.href = "/login";
    }
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Loading Marketplace...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">
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

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4 text-xs font-bold [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5 text-xs font-bold [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
              A better home<br />for a brighter you.
            </h4>
            <p className="mt-1 text-[10px] text-slate-400">
              Quality products. Trusted professionals.
            </p>
            <Link
              href="/dashboard/bookings/new"
              className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <span>Explore More</span>
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
            MARKETPLACE
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
                  alt={userName}
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
                {userName}
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
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-700">
            <span>🏠</span>
            <span>Home</span>
          </Link>
          <span>/</span>
          <span className="text-blue-600">Marketplace</span>
        </div>

        {/* ========================================================
            HERO PROMOTIONAL BANNER & TRUST BADGES
        ======================================================== */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 sm:p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left 7 cols: Title & Trust Badges */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                  Home Products
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-xl leading-relaxed">
                  Discover quality products from HomeMate businesses for your home maintenance and improvement needs.
                </p>
              </div>

              {/* 4 Trust Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50/70 p-3 border border-emerald-100">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <p className="text-[11px] font-black text-slate-900 leading-tight">Verified Sellers</p>
                    <p className="text-[9px] text-slate-500">Trusted businesses</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-2xl bg-blue-50/70 p-3 border border-blue-100">
                  <span className="text-xl">🚚</span>
                  <div>
                    <p className="text-[11px] font-black text-slate-900 leading-tight">Fast Delivery</p>
                    <p className="text-[9px] text-slate-500">At your doorstep</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-2xl bg-purple-50/70 p-3 border border-purple-100">
                  <span className="text-xl">🔄</span>
                  <div>
                    <p className="text-[11px] font-black text-slate-900 leading-tight">Easy Returns</p>
                    <p className="text-[9px] text-slate-500">Hassle-free</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50/70 p-3 border border-amber-100">
                  <span className="text-xl">⭐</span>
                  <div>
                    <p className="text-[11px] font-black text-slate-900 leading-tight">Quality Assurance</p>
                    <p className="text-[9px] text-slate-500">Genuine products</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Promo Banner Graphic */}
            <div className="lg:col-span-5 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 p-6 border border-amber-200/80 shadow-inner flex flex-col justify-between min-h-[190px]">
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-snug">
                  Everything<br />for a Better Home
                </h3>
                <p className="mt-1 text-xs text-slate-600 max-w-[200px]">
                  Tools, materials, appliances and more — all in one place.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("marketplace-catalog");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 transition"
                >
                  Shop Now →
                </button>

                <div className="text-right">
                  <p className="text-[10px] font-serif italic font-bold text-blue-900 leading-tight">
                    Build<br />Maintain<br />Improve
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            FILTER CONTROLS & CART SUMMARY BAR
        ======================================================== */}
        <div id="marketplace-catalog" className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[minmax(300px,1fr)_180px_160px_auto] gap-3 flex-1">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name, brand or keyword..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm"
              />
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none transition"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none transition"
            >
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="stock">Stock Available</option>
            </select>

            {/* Clear Filters */}
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-40"
            >
              <span>🧹</span>
              <span>Clear Filters</span>
            </button>
          </div>

          {/* Cart Box with Dynamic Badge Counter */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <div className="relative">
                <span className="text-xl">🛒</span>
                <span
                  className={`absolute -top-1.5 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-black text-white shadow-sm transition-all duration-300 ${cartCount > 0 ? "bg-rose-500 scale-100 animate-pulse" : "bg-slate-400 scale-95"
                    }`}
                >
                  {cartCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900">My Cart</p>
                <p className="text-[10px] text-slate-400">
                  {cartCount} {cartCount === 1 ? "item" : "items"}
                </p>
              </div>
              <Link
                href="/dashboard/marketplace/cart"
                className="ml-2 rounded-xl bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition"
              >
                View Cart →
              </Link>
            </div>
          </div>
        </div>

        {/* Counter and Grid/List View Toggles */}
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold pt-1">
          <p>
            Showing {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "product" : "products"}
          </p>

          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition ${viewMode === "grid"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <span>⊞</span>
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition ${viewMode === "list"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <span>☰</span>
              <span>List</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            PRODUCTS LIST / GRID
        ======================================================== */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
              📦
            </div>
            <h2 className="text-lg font-black text-slate-900">
              No Matching Products
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
              We couldn't find any products matching your current search or filter selection.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === "list"
                ? "space-y-6"
                : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            }
          >
            {filteredProducts.map((product) => {
              const isFav = !!favorites[product.$id];
              const stock = Number(product.stock) || 0;
              const isInStock = product.stock > 0;
              const originalPrice = Math.round(product.price * 1.18);
              const discountPercent = Math.round(
                ((originalPrice - product.price) / originalPrice) * 100
              );

              return (
                <article
                  key={product.$id}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div
                    className={
                      viewMode === "list"
                        ? "flex flex-col lg:flex-row gap-6"
                        : "flex flex-col gap-4"
                    }
                  >
                    {/* Product Photo Box with In Stock Badge & Wishlist Heart */}
                    <div
                      className={`relative overflow-hidden rounded-2xl bg-slate-100 border border-slate-100 shrink-0 ${viewMode === "list"
                        ? "h-64 lg:h-auto lg:w-80"
                        : "h-60 w-full"
                        }`}
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.productName}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl text-slate-300">
                          📦
                        </div>
                      )}

                      {/* Stock Pill */}
                      <span
                        className={`absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase shadow-sm backdrop-blur ${isInStock
                          ? "bg-emerald-500 text-white"
                          : "bg-rose-500 text-white"
                          }`}
                      >
                        {isInStock ? "IN STOCK" : "OUT OF STOCK"}
                      </span>

                      {/* Favorite Heart Button */}
                      <button
                        type="button"
                        onClick={() => toggleFavorite(product.$id)}
                        className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:scale-110"
                        aria-label="Wishlist"
                      >
                        <span className={isFav ? "text-rose-500 text-base" : "text-slate-400 text-base"}>
                          {isFav ? "❤️" : "🤍"}
                        </span>
                      </button>

                      {/* Carousel Indicator Dots */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                      </div>
                    </div>

                    {/* Details Body */}
                    <div className="flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        {/* Category & Stock Count */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {product.category || "HOME TOOLS"}
                          </span>
                          {isInStock ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span>In Stock</span>

                              {stock <= 5 && (
                                <span className="text-slate-400 font-medium">
                                  (Only {stock} left)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              <span>Out of Stock</span>
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                          {product.productName}
                        </h2>

                        {/* Ratings */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex text-amber-400 text-xs">
                            ⭐⭐⭐⭐⭐
                          </div>
                          <span className="text-xs font-bold text-slate-700">4.8</span>
                          <span className="text-xs text-slate-400">(120 reviews)</span>
                        </div>

                        {/* Description */}
                        <p className="mt-2.5 text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {product.description ||
                            "Waterproof designer almirah with attractive cupboard design. Perfect for modern homes with ample storage space and elegant finish."}
                        </p>

                        {/* Feature Badges */}
                        <div className="flex flex-wrap gap-2.5 mt-4">
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                            <span>💧</span>
                            <span>Waterproof Material</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                            <span>🚪</span>
                            <span>Spacious Storage</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                            <span>✨</span>
                            <span>Modern Design</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                            <span>🔧</span>
                            <span>Easy Installation</span>
                          </span>
                        </div>
                      </div>

                      {/* Pricing Row & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-4">
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-2xl font-black text-slate-900">
                            ₹{product.price.toLocaleString("en-IN")}
                          </span>
                          <span className="text-xs text-slate-400 line-through">
                            ₹{originalPrice.toLocaleString("en-IN")}
                          </span>
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-600 border border-emerald-100">
                            {discountPercent}% OFF
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/marketplace/${product.$id}`}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm text-center"
                          >
                            View Details
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleAddToCart(product)}
                            disabled={!isInStock || addToCartMutation.isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                          >
                            <span>🛒</span>
                            <span>
                              {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
                            </span>
                          </button>
                        </div>
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