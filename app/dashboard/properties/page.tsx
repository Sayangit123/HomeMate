"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getUserProperties } from "@/lib/appwrite/property";
import { getPropertyImageUrl, getProfileImageUrl } from "@/lib/appwrite/storage";
import { getCurrentMember } from "@/lib/appwrite/database";
import { usePropertyStore } from "@/lib/stores/property-store";
import { useAuthStore } from "@/lib/stores/auth-store";

/* ============================================================
   APPWRITE CONFIG & TYPES
============================================================ */

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Property {
  $id: string;
  propertyName: string;
  propertyType: "Apartment" | "House" | "Office" | "Villa" | "Other";
  address: string;
  location: string | null;
  propertyImages: string | null;
  rooms: string | null;
  appliances: string | null;
  $createdAt?: string;
  $updatedAt?: string;
}

const fetchUserProperties = async (): Promise<Property[]> => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be logged in to view your properties.");
  }

  const response = await getUserProperties(user.$id);
  return response.documents as unknown as Property[];
};

export default function PropertiesPage() {
  const router = useRouter();
  const { setSelectedPropertyId } = usePropertyStore();

  // Zustand Auth Store
  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  // Local Filter & Layout States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  /* ==========================================================
     TANSTACK QUERY: PROPERTIES DATA
  ========================================================== */
  const {
    data: properties = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["properties"],
    queryFn: fetchUserProperties,
    staleTime: 30 * 1000,
  });

  /* ==========================================================
     TANSTACK QUERY: USER PROFILE DATA
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

  /* ==========================================================
     TANSTACK QUERY: LIVE UNREAD NOTIFICATIONS COUNT
  ========================================================== */
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
        try {
          const fallbackRes = await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_TABLE_ID,
            [AppwriteQuery.equal("userId", activeUserId), AppwriteQuery.equal("status", "unread")]
          );
          return fallbackRes.total ?? fallbackRes.documents.length;
        } catch {
          return 0;
        }
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

  useEffect(() => {
    if (!isError) return;

    let message = "Unable to load your properties.";
    if (error instanceof Error) {
      message = error.message;
    }

    Swal.fire({
      icon: "error",
      title: "Unable to Load Properties",
      text: message,
      confirmButtonColor: "#0f172a",
    });
  }, [isError, error]);

  const getFirstImageId = (propertyImages: string | null) => {
    if (!propertyImages) return null;
    try {
      const imageIds = JSON.parse(propertyImages);
      if (Array.isArray(imageIds) && imageIds.length > 0) {
        return imageIds[0];
      }
      return null;
    } catch {
      return null;
    }
  };

  const handlePropertySelect = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
  };

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

  /* ==========================================================
     FILTERED PROPERTIES
  ========================================================== */
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        property.propertyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (property.location && property.location.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = selectedType === "All" || property.propertyType === selectedType;

      return matchesSearch && matchesType;
    });
  }, [properties, searchQuery, selectedType]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "17 Sept 2026";
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "17 Sept 2026";
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">

      {/* Mobile Backdrop */}
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
              Manage. Maintain. Live Better.
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

      {/* Top Navbar (No searchbar, profile info on right) */}
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
            PROPERTY MANAGEMENT
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

      {/* Main Content */}
      <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
        {/* ========================================================
            HERO PROMOTIONAL BANNER
        ======================================================== */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-100 via-sky-50 to-blue-50 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                PROPERTY MANAGEMENT
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                My Properties
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
                Manage all your properties from one place.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="hidden xl:flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 border border-white/80 shadow-sm backdrop-blur">
                <span className="text-2xl">🏡</span>
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-700 uppercase">Your Properties</p>
                  <p className="text-[9px] font-semibold text-slate-400">Our Care</p>
                </div>
              </div>

              <Link
                href="/dashboard/properties/add"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition"
              >
                <span>+</span>
                <span>Add Property</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================
            IN-PAGE FILTER & SEARCH CONTROLS
        ======================================================== */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search bar inside page */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by property name, location..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="All">All Types</option>
              <option value="House">House</option>
              <option value="Apartment">Apartment</option>
              <option value="Office">Office</option>
              <option value="Villa">Villa</option>
              <option value="Other">Other</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-xl p-1.5 text-xs transition ${
                  viewMode === "grid"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="Grid view"
              >
                ⊞
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-xl p-1.5 text-xs transition ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="List view"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* Counter */}
        <p className="text-xs font-bold text-slate-400">
          {filteredProperties.length}{" "}
          {filteredProperties.length === 1 ? "property" : "properties"} added
        </p>

        {/* ========================================================
            LOADING / ERROR / EMPTY STATES
        ======================================================== */}
        {loading && (
          <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mx-auto" />
            <p className="mt-3 text-xs font-bold text-slate-400">
              Loading your properties...
            </p>
          </div>
        )}

        {isError && !loading && (
          <div className="rounded-3xl border border-rose-100 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-bold text-rose-500">
              Unable to load your properties.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !isError && filteredProperties.length === 0 && (
          <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
              🏠
            </div>
            <h2 className="text-lg font-black text-slate-900">
              No Properties Found
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
              {searchQuery || selectedType !== "All"
                ? "No properties match your current search and filter criteria."
                : "You haven't added any properties yet. Add your first property to start managing it through HomeMate."}
            </p>
            <Link
              href="/dashboard/properties/add"
              className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              + Add Property
            </Link>
          </div>
        )}

        {/* ========================================================
            PROPERTIES LIST (HORIZONTAL CARDS MATCHING REFERENCE)
        ======================================================== */}
        {!loading && !isError && filteredProperties.length > 0 && (
          <div className={viewMode === "list" ? "space-y-5" : "grid gap-6 md:grid-cols-2"}>
            {filteredProperties.map((property) => {
              const imageId = getFirstImageId(property.propertyImages);
              const imageUrl = imageId ? getPropertyImageUrl(imageId) : null;

              return (
                <article
                  key={property.$id}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Property Image & Status Pill */}
                    <div className="relative h-56 lg:h-auto lg:w-72 shrink-0 overflow-hidden rounded-2xl bg-slate-100 border border-slate-100">
                      {imageUrl ? (
                        <img
                          src={imageUrl.toString()}
                          alt={property.propertyName}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl text-slate-300">
                          🏡
                        </div>
                      )}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md px-3 py-1 text-[10px] font-black text-white shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Active
                      </span>
                    </div>

                    {/* Property Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        {/* Title, Badge & Edit Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                {property.propertyName}
                              </h2>
                              <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-600 border border-blue-100">
                                {property.propertyType}
                              </span>
                            </div>

                            {/* Address / Location */}
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <span>📍</span>
                              <span>
                                {property.location
                                  ? `${property.address}, ${property.location}`
                                  : property.address}
                              </span>
                            </p>
                          </div>

                          {/* Quick Edit */}
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/properties/${property.$id}/edit`}
                              onClick={() => handlePropertySelect(property.$id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </Link>
                          </div>
                        </div>

                        {/* Metadata Row: Property Type & Rooms (Area sq ft completely removed) */}
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                              🏠
                            </span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                PROPERTY TYPE
                              </p>
                              <p className="text-xs font-black text-slate-800">
                                {property.propertyType}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 text-lg">
                              🚪
                            </span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                ROOMS & AREAS
                              </p>
                              <p className="text-xs font-black text-slate-800 truncate max-w-[180px]">
                                {property.rooms || "Standard configuration"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer Info Row: Added On, Last Updated & View Details Action */}
                      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-6 text-[11px] text-slate-400 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>📅</span>
                            <span>Added on: {formatDate(property.$createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>⏱️</span>
                           <span>Updated: {formatDate(property.$updatedAt || property.$createdAt)}</span>
                          </div>
                        </div>

                        <Link
                          href={`/dashboard/properties/${property.$id}`}
                          onClick={() => handlePropertySelect(property.$id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition"
                        >
                          <span>View Details</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ========================================================
            BOTTOM CALLOUT: ADD ANOTHER PROPERTY
        ======================================================== */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600 shadow-sm">
              🏠
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Want to add another property?
              </h3>
              <p className="text-xs text-slate-500">
                Add your other homes, apartments, offices or rental properties to get started.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/properties/add"
            className="shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition"
          >
            + Add Property
          </Link>
        </div>
      </main>
    </div>
  );
}