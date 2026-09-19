"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getProfessionals } from "@/lib/appwrite/professional";
import { useProfessionalStore } from "@/lib/stores/professional-store";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";
import { useAuthStore } from "@/lib/stores/auth-store";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

const ProfessionalMap = dynamic(
  () => import("@/components/professionals/ProfessionalMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
        Loading interactive map...
      </div>
    ),
  }
);

interface Professional {
  $id: string;
  professionalName: string;
  serviceCategory: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceArea?: string | null;
  rating?: number | null;
  availability?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  locationVisibility?: boolean;
}

const DEFAULT_LATITUDE = 22.5726;
const DEFAULT_LONGITUDE = 88.3639;

const calculateDistance = (
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) => {
  const earthRadius = 6371;
  const latitudeDifference = ((latitude2 - latitude1) * Math.PI) / 180;
  const longitudeDifference = ((longitude2 - longitude1) * Math.PI) / 180;
  const firstLatitude = (latitude1 * Math.PI) / 180;
  const secondLatitude = (latitude2 * Math.PI) / 180;

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const fetchProfessionals = async (): Promise<Professional[]> => {
  const response = await getProfessionals();
  return response.documents as unknown as Professional[];
};

export default function ProfessionalsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [navbarSearch, setNavbarSearch] = useState("");

  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  const {
    selectedProfessionalId,
    selectedCategory,
    selectedDistance,
    selectedRating,
    selectedAvailability,
    selectedPrice,
    setSelectedProfessionalId,
    setSelectedCategory,
    setSelectedDistance,
    setSelectedRating,
    setSelectedAvailability,
    setSelectedPrice,
    clearSelectedProfessional,
  } = useProfessionalStore();

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
        name: member?.fullName?.trim() || currentUser.name?.trim() || "User",
        email: currentUser.email || "",
        role: member?.role || "customer",
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

  const {
    data: professionals = [],
    isLoading: loading,
    isError,
    error,
  } = useQuery({
    queryKey: ["professionals"],
    queryFn: fetchProfessionals,
  });

  useEffect(() => {
    if (!isError) return;
    const showError = async () => {
      await Swal.fire({
        icon: "error",
        title: "Unable to load professionals",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong while loading professional data.",
      });
    };
    showError();
  }, [isError, error]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        professionals
          .map((professional) => professional.serviceCategory)
          .filter(Boolean)
      )
    );
    return uniqueCategories.sort();
  }, [professionals]);

  const filteredProfessionals = useMemo(() => {
    let result = professionals;

    if (selectedCategory !== "All Categories") {
      result = result.filter(
        (professional) => professional.serviceCategory === selectedCategory
      );
    }

    if (selectedDistance !== "Any Distance") {
      const maximumDistance = Number(selectedDistance);
      result = result.filter((professional) => {
        if (professional.latitude == null || professional.longitude == null) {
          return false;
        }
        const distance = calculateDistance(
          DEFAULT_LATITUDE,
          DEFAULT_LONGITUDE,
          professional.latitude,
          professional.longitude
        );
        return distance <= maximumDistance;
      });
    }

    if (selectedRating !== "Any Rating") {
      const minimumRating = Number(selectedRating);
      result = result.filter((professional) => {
        if (professional.rating == null) return false;
        return professional.rating >= minimumRating;
      });
    }

    if (selectedAvailability !== "Any Availability") {
      result = result.filter(
        (professional) => professional.availability === selectedAvailability
      );
    }

    if (selectedPrice !== "Any Price") {
      const maximumPrice = Number(selectedPrice);
      result = result.filter((professional) => {
        if (professional.minPrice == null) return false;
        return professional.minPrice <= maximumPrice;
      });
    }

    return result;
  }, [
    professionals,
    selectedCategory,
    selectedDistance,
    selectedRating,
    selectedAvailability,
    selectedPrice,
  ]);

  const selectedProfessional = useMemo(() => {
    if (!selectedProfessionalId) return null;
    return (
      professionals.find(
        (professional) => professional.$id === selectedProfessionalId
      ) ?? null
    );
  }, [professionals, selectedProfessionalId]);

  useEffect(() => {
    if (
      selectedProfessionalId &&
      !filteredProfessionals.some(
        (professional) => professional.$id === selectedProfessionalId
      )
    ) {
      clearSelectedProfessional();
    }
  }, [filteredProfessionals, selectedProfessionalId, clearSelectedProfessional]);

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
    } catch (err) {
      console.error("Logout error:", err);
      clearUser();
      setLoggingOut(false);
      window.location.href = "/login";
    }
  };

  if (!mounted) {
    return null;
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
          <Link href="/dashboard/professionals" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md">
            <span>🔍</span><span>Find Professionals</span>
          </Link>
          <Link href="/dashboard/properties" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>🏘️</span><span>My Properties</span>
          </Link>
          <Link href="/dashboard/maintenance" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>🔧</span><span>Maintenance</span>
          </Link>
          <Link href="/dashboard/bookings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>📅</span><span>My Bookings</span>
          </Link>
          <Link href="/dashboard/marketplace" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>🛒</span><span>Marketplace</span>
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
          <Link href="/dashboard/bookings" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span>📅</span><span>My Bookings</span>
          </Link>
          <Link href="/dashboard/marketplace" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span>🛒</span><span>Marketplace</span>
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
          <Link href="/dashboard/professionals" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30">
            <span>🔍</span><span>Find Professionals</span>
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
              🏡
            </div>
            <h4 className="text-xs font-black text-white leading-tight">
              Trusted Professionals<br />for a Better Home
            </h4>
            <p className="mt-1 text-[10px] text-slate-400">
              Skilled. Verified. Affordable.
            </p>
            <Link
              href="/dashboard/bookings/new"
              className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <span>Book a Service</span>
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
              placeholder="Search services, professionals, locations..."
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
              <p className="text-[10px] font-medium text-slate-400">{userEmail}</p>
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
            <span className="text-blue-600">Find Professionals</span>
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
                HOMEMATE SERVICES
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                Find Nearby Professionals
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Discover trusted professionals around you based on service category, location, rating, availability, and pricing.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-6 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span className="text-emerald-600">✓</span> Verified Professionals
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span className="text-blue-600">★</span> Customer Reviews
              </div>
            </div>
          </div>
        </div>

        {/* STATISTICS CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
              👥
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Total Professionals</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{professionals.length}</p>
              <p className="text-[10px] text-slate-400">Trusted experts</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Matching Professionals</p>
              <p className="text-2xl font-black text-blue-600 mt-0.5">
                {
                  filteredProfessionals.filter(
                    (professional) =>
                      professional.locationVisibility !== false &&
                      professional.latitude != null &&
                      professional.longitude != null
                  ).length
                }
              </p>
              <p className="text-[10px] text-slate-400">In your area</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
              📂
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Service Categories</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">{categories.length}</p>
              <p className="text-[10px] text-slate-400">Available services</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 text-xl font-bold">
              📍
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Your Location</p>
              <p className="text-sm font-black text-slate-900 mt-0.5">Kestopur, Kolkata</p>
              <p className="text-[10px] text-blue-600 font-bold cursor-pointer hover:underline">Change Location</p>
            </div>
          </div>
        </div>

        {/* FILTER SECTION */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">Filter Professionals</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Filter professionals by service category, distance, rating, availability, and price.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory("All Categories");
                setSelectedDistance("Any Distance");
                setSelectedRating("Any Rating");
                setSelectedAvailability("Any Availability");
                setSelectedPrice("Any Price");
              }}
              className="text-xs font-bold text-blue-600 hover:underline mt-2 sm:mt-0"
            >
              Reset Filters ↺
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* CATEGORY */}
            <div>
              <label htmlFor="serviceCategory" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                Service Category
              </label>
              <select
                id="serviceCategory"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="All Categories">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* DISTANCE */}
            <div>
              <label htmlFor="distance" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                Distance
              </label>
              <select
                id="distance"
                value={selectedDistance}
                onChange={(event) => setSelectedDistance(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="Any Distance">Any Distance</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="20">Within 20 km</option>
                <option value="50">Within 50 km</option>
              </select>
            </div>

            {/* RATING */}
            <div>
              <label htmlFor="rating" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                Minimum Rating
              </label>
              <select
                id="rating"
                value={selectedRating}
                onChange={(event) => setSelectedRating(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="Any Rating">Any Rating</option>
                <option value="4">4.0+ ⭐</option>
                <option value="4.5">4.5+ ⭐</option>
                <option value="4.8">4.8+ ⭐</option>
              </select>
            </div>

            {/* AVAILABILITY */}
            <div>
              <label htmlFor="availability" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                Availability
              </label>
              <select
                id="availability"
                value={selectedAvailability}
                onChange={(event) => setSelectedAvailability(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="Any Availability">Any Availability</option>
                <option value="Available Today">Available Today</option>
                <option value="Available Tomorrow">Available Tomorrow</option>
              </select>
            </div>

            {/* PRICE */}
            <div>
              <label htmlFor="price" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase">
                Price Range
              </label>
              <select
                id="price"
                value={selectedPrice}
                onChange={(event) => setSelectedPrice(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="Any Price">Any Price</option>
                <option value="500">Up to ₹500</option>
                <option value="1000">Up to ₹1,000</option>
                <option value="1500">Up to ₹1,500</option>
                <option value="2000">Up to ₹2,000</option>
                <option value="5000">Up to ₹5,000</option>
              </select>
            </div>
          </div>
        </section>

        {/* MAP SECTION */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Professionals Near You</h2>
              <p className="text-xs text-slate-500">Select a marker on the map to view professional details.</p>
            </div>
            <span className="text-xs font-bold text-blue-600">Interactive Map View</span>
          </div>

          {loading ? (
            <div className="flex h-[500px] items-center justify-center rounded-2xl bg-slate-50">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <p className="text-xs font-bold text-slate-400">Loading professionals map...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <ProfessionalMap
                professionals={filteredProfessionals}
                selectedProfessional={selectedProfessional}
                onSelectProfessional={(professional) =>
                  setSelectedProfessionalId(professional.$id)
                }
              />
            </div>
          )}
        </section>

        {/* PROFESSIONAL PROFILE PREVIEW MODAL / SECTION */}
        {selectedProfessional && (
          <section className="rounded-3xl border-2 border-blue-500 bg-white p-6 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">PROFESSIONAL DETAILS</span>
                <h2 className="text-lg font-black text-slate-900">{selectedProfessional.professionalName}</h2>
              </div>
              <button
                type="button"
                onClick={clearSelectedProfessional}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                    {selectedProfessional.serviceCategory}
                  </span>
                  {selectedProfessional.rating != null && (
                    <span className="text-xs font-bold text-amber-500">
                      ★ {selectedProfessional.rating.toFixed(1)} / 5.0
                    </span>
                  )}
                </div>

                {selectedProfessional.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{selectedProfessional.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Service Area</p>
                    <p className="text-xs font-black text-slate-800 mt-0.5">{selectedProfessional.serviceArea || "Not specified"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Availability</p>
                    <p className="text-xs font-black text-emerald-600 mt-0.5">{selectedProfessional.availability || "Available"}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Starting Price</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {selectedProfessional.minPrice != null ? `₹${selectedProfessional.minPrice}` : "On Request"}
                  </p>
                </div>
                <div className="space-y-2 mt-4">
                  <Link
                    href={`/dashboard/bookings/new?proId=${selectedProfessional.$id}`}
                    className="block w-full rounded-xl bg-blue-600 py-2.5 text-center text-xs font-bold text-white shadow hover:bg-blue-700 transition"
                  >
                    Book Now →
                  </Link>
                  {selectedProfessional.latitude != null && selectedProfessional.longitude != null && (
                    <button
                      type="button"
                      onClick={() => {
                        window.open(
                          `https://www.google.com/maps?q=${selectedProfessional.latitude},${selectedProfessional.longitude}`,
                          "_blank"
                        );
                      }}
                      className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Open in Google Maps
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* AVAILABLE PROFESSIONALS CARD LIST */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Available Professionals ({filteredProfessionals.length})
              </h2>
              <p className="text-xs text-slate-500">Browse professionals matching your selected criteria.</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border bg-white p-16 text-center shadow-sm">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="mt-3 text-xs text-slate-400">Loading professionals...</p>
            </div>
          ) : filteredProfessionals.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
              <span className="text-4xl">🔍</span>
              <h3 className="text-base font-bold text-slate-900 mt-3">No Professionals Found</h3>
              <p className="text-xs text-slate-400 mt-1">Try changing your category, distance, or price filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProfessionals.map((professional) => {
                const isSelected = selectedProfessional?.$id === professional.$id;

                return (
                  <div
                    key={professional.$id}
                    className={`flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                      isSelected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200/80 hover:border-blue-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black text-slate-900">{professional.professionalName}</h3>
                          <p className="text-xs font-bold text-blue-600 mt-0.5">{professional.serviceCategory}</p>
                        </div>
                        {professional.rating != null && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600 border border-amber-200">
                            ★ {professional.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {professional.description && (
                        <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {professional.description}
                        </p>
                      )}

                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
                        {professional.serviceArea && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Service Area</span>
                            <span className="font-bold text-slate-800">{professional.serviceArea}</span>
                          </div>
                        )}
                        {professional.availability && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Availability</span>
                            <span className="font-bold text-emerald-600">{professional.availability}</span>
                          </div>
                        )}
                        {professional.minPrice != null && professional.maxPrice != null && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Price Range</span>
                            <span className="font-bold text-slate-900">₹{professional.minPrice} - ₹{professional.maxPrice}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProfessionalId(professional.$id)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                      >
                        View on Map
                      </button>
                      <Link
                        href={`/dashboard/bookings/new?proId=${professional.$id}`}
                        className="flex-1 rounded-xl bg-blue-600 py-2 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}