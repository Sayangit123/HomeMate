"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getPropertyById } from "@/lib/appwrite/property";
import { getPropertyImageUrl, getProfileImageUrl } from "@/lib/appwrite/storage";
import { getCurrentMember } from "@/lib/appwrite/database";
import { useAuthStore } from "@/lib/stores/auth-store";

/* ============================================================
   CONFIG & TYPES
============================================================ */

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Property {
  $id: string;
  userId: string;
  propertyName: string;
  propertyType: "Apartment" | "House" | "Office" | "Villa" | "Other";
  address: string;
  location: string | null;
  propertyImages: string | null;
  rooms: string | null;
  appliances: string | null;
  maintenanceHistory: string | null;
  upcomingMaintenance: string | null;
  $createdAt?: string;
  $updatedAt?: string;
}

export default function PropertyDetailsPage() {
  const router = useRouter();
  const pathname = usePathname();

  const propertyId =
    pathname
      .split("/")
      .filter(Boolean)
      .pop() || "";

  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  /* ==========================================================
     TANSTACK QUERY: UNREAD NOTIFICATIONS COUNT
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
     LOAD PROPERTY DETAILS
  ========================================================== */
  useEffect(() => {
    const loadProperty = async () => {
      try {
        setLoading(true);

        if (!propertyId) {
          await Swal.fire({
            icon: "error",
            title: "Invalid Property",
            text: "Property ID is missing from the URL.",
            confirmButtonColor: "#0f172a",
          });
          router.push("/dashboard/properties");
          return;
        }

        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const propertyData = (await getPropertyById(propertyId)) as unknown as Property;

        if (!propertyData) {
          throw new Error("Property could not be found.");
        }

        if (propertyData.userId !== user.$id) {
          await Swal.fire({
            icon: "error",
            title: "Access Denied",
            text: "You do not have permission to view this property.",
            confirmButtonColor: "#0f172a",
          });
          router.push("/dashboard/properties");
          return;
        }

        setProperty(propertyData);

        if (propertyData.propertyImages) {
          try {
            const parsedImages = JSON.parse(propertyData.propertyImages);
            if (Array.isArray(parsedImages) && parsedImages.length > 0) {
              setImageIds(parsedImages);
            }
          } catch (error) {
            console.error("Unable to parse property images:", error);
          }
        }
      } catch (error: unknown) {
        let message = "Unable to load property details.";
        if (error instanceof Error) {
          message = error.message;
        }

        await Swal.fire({
          icon: "error",
          title: "Property Not Found",
          text: message,
          confirmButtonColor: "#0f172a",
        });

        router.push("/dashboard/properties");
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [propertyId, pathname, router]);

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

  // Carousel Next/Prev Controls
  const handleNextImage = () => {
    if (imageIds.length === 0) return;
    setActiveImageIndex((prev) => (prev + 1) % imageIds.length);
  };

  const handlePrevImage = () => {
    if (imageIds.length === 0) return;
    setActiveImageIndex((prev) => (prev - 1 + imageIds.length) % imageIds.length);
  };

  /* ==========================================================
     LOADING / ERROR STATES
  ========================================================== */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Loading property details...
          </p>
        </div>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
            🏠
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-900">
            Property Not Found
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            The property you are looking for does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/dashboard/properties"
            className="mt-6 inline-flex rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            Back to My Properties
          </Link>
        </div>
      </main>
    );
  }

  const currentMainImage =
    imageIds.length > 0
      ? getPropertyImageUrl(imageIds[activeImageIndex]).toString()
      : null;

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
            PROPERTY DETAILS
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

      {/* Main Container */}
      <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
        {/* ========================================================
            SUB-HEADER WITH ACTIONS
        ======================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/properties"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline mb-2"
            >
              <span>←</span>
              <span>Back to My Properties</span>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {property.propertyName}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-600 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Complete information about your property.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/properties/${property.$id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <span>✏️</span>
              <span>Edit Property</span>
            </Link>

            <Link
              href="/dashboard/maintenance"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              <span>⚙️</span>
              <span>Manage Services</span>
            </Link>
          </div>
        </div>

        {/* ========================================================
            MAIN 2-COLUMN DISPLAY (GALLERY + DETAILS)
        ======================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT 6 COLS: IMAGE CAROUSEL & THUMBNAILS */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative h-80 sm:h-96 w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-sm">
              {currentMainImage ? (
                <img
                  src={currentMainImage}
                  alt={property.propertyName}
                  className="h-full w-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-7xl text-slate-600">
                  🏡
                </div>
              )}

              {/* Counter Pill */}
              {imageIds.length > 0 && (
                <span className="absolute top-4 right-4 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                  {activeImageIndex + 1} / {imageIds.length}
                </span>
              )}

              {/* Carousel Arrows */}
              {imageIds.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute top-1/2 left-3 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 backdrop-blur text-slate-800 shadow-md hover:bg-white transition"
                    aria-label="Previous image"
                  >
                    ❮
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute top-1/2 right-3 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 backdrop-blur text-slate-800 shadow-md hover:bg-white transition"
                    aria-label="Next image"
                  >
                    ❯
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Row */}
            {imageIds.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {imageIds.slice(0, 5).map((imgId, idx) => (
                  <button
                    key={imgId}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative h-16 sm:h-20 overflow-hidden rounded-2xl border-2 transition ${
                      activeImageIndex === idx
                        ? "border-blue-600 ring-2 ring-blue-100 scale-95"
                        : "border-slate-200 hover:opacity-90"
                    }`}
                  >
                    <img
                      src={getPropertyImageUrl(imgId).toString()}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT 6 COLS: STRUCTURED PROPERTY SPECIFICATIONS */}
          <div className="lg:col-span-6 space-y-4">
            {/* Top Identity Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      {property.propertyName}
                    </h2>
                    <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-black uppercase text-blue-600 border border-blue-100">
                      {property.propertyType}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <span>📍</span>
                    <span>
                      {property.location
                        ? `${property.address}, ${property.location}`
                        : property.address}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-2 border border-slate-100 shrink-0">
                  <span className="text-lg">📍</span>
                  <div className="text-left text-[11px]">
                    <p className="font-bold text-slate-800">
                      {property.location || "City Location"}
                    </p>
                    <span className="text-blue-600 font-semibold cursor-pointer hover:underline">
                      View on Map →
                    </span>
                  </div>
                </div>
              </div>

              {/* SPECIFICATION TILES (AREA SQ FT HAS BEEN REMOVED) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Property Type */}
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-xl">
                    🏠
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      PROPERTY TYPE
                    </p>
                    <p className="text-xs font-black text-slate-900">
                      {property.propertyType}
                    </p>
                  </div>
                </div>

                {/* Rooms & Areas */}
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 sm:col-span-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 text-xl">
                    🚪
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      ROOMS & AREAS
                    </p>
                    <p className="text-xs font-black text-slate-900">
                      {property.rooms || "4 Rooms • 2 Bathrooms"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">📄</span>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Property Description
                  </h4>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  {property.appliances
                    ? `Equipped with modern amenities and appliances: ${property.appliances}. Well ventilated and secured residential space located in ${property.location || property.address}.`
                    : `A beautiful and well-maintained property located in ${property.address}. Spacious rooms, modern interiors, good ventilation and a peaceful neighborhood.`}
                </p>
              </div>

              {/* Timestamps & Status Footer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ADDED ON
                  </p>
                  <p className="mt-0.5 text-xs font-black text-slate-800">
                    {formatDate(property.$createdAt)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    LAST UPDATED
                  </p>
                  <p className="mt-0.5 text-xs font-black text-slate-800">
                    {formatDate(property.$updatedAt || property.$createdAt)}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white text-xs">
                    ✓
                  </span>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-emerald-700">STATUS</p>
                    <p className="text-xs font-black text-slate-900">Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            PROPERTY FEATURES & AMENITIES
        ======================================================== */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Property Features & Appliances
            </h3>
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              { label: "Car Parking", icon: "🚗" },
              { label: "Garden", icon: "🌿" },
              { label: "Security", icon: "🛡️" },
              { label: "Balcony", icon: "🏙️" },
              { label: "Water Supply", icon: "💧" },
              { label: "Electricity", icon: "⚡" },
              { label: "Wi-Fi Ready", icon: "📶" },
            ].map((feat) => (
              <span
                key={feat.label}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-white hover:border-blue-300 transition"
              >
                <span>{feat.icon}</span>
                <span>{feat.label}</span>
              </span>
            ))}

            {property.appliances && (
              <span className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-2 text-xs font-bold text-blue-700">
                <span>🔌</span>
                <span>{property.appliances}</span>
              </span>
            )}
          </div>
        </div>

        {/* ========================================================
            MAINTENANCE OVERVIEW SECTION
        ======================================================== */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* History */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <h3 className="text-sm font-black text-slate-900">
                  Maintenance History
                </h3>
              </div>
              <Link
                href="/dashboard/maintenance"
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View Hub →
              </Link>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              {property.maintenanceHistory ||
                "No previous maintenance tickets recorded for this property. All periodic servicing is currently up to date."}
            </p>
          </div>

          {/* Upcoming Work */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🔧</span>
                <h3 className="text-sm font-black text-slate-900">
                  Upcoming Maintenance
                </h3>
              </div>
              <Link
                href="/dashboard/bookings/new"
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Schedule Work →
              </Link>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              {property.upcomingMaintenance ||
                "No upcoming maintenance scheduled. Need routine electrical, plumbing, or AC cleaning? Book certified technicians anytime."}
            </p>
          </div>
        </div>

        {/* ========================================================
            BOTTOM ACTIONS BAR
        ======================================================== */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/80 pt-6">
          <Link
            href="/dashboard/properties"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            ← Back to My Properties
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/properties/${property.$id}/edit`}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              Edit Details
            </Link>

            <Link
              href="/dashboard/bookings/new"
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              Book Service for Property →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}