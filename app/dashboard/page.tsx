"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query } from "appwrite";
import Swal from "sweetalert2";

import client from "@/lib/appwrite/client";
import {
  getCurrentUser,
  logoutAccount,
} from "@/lib/appwrite/account";
import {
  getCurrentMember,
  updateMemberProfileCompletion,
} from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";
import { useAuthStore, type AuthRole } from "@/lib/stores/auth-store";

/* ============================================================
   APPWRITE CONFIG
============================================================ */

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const PROFESSIONALS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROFESSIONALS_TABLE_ID || "professionals";
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface AppwriteUser {
  $id: string;
  name: string;
  email: string;
  $createdAt: string;
}

export default function DashboardPage() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Zustand state sync
  const storedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  /* ==========================================================
     TANSTACK QUERY: FETCH USER, MEMBER & PROFESSIONAL DATA
  ========================================================== */
  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["user", "dashboard-profile"],
    queryFn: async () => {
      const currentUser = (await getCurrentUser()) as AppwriteUser;
      if (!currentUser) throw new Error("No session found");

      const currentMember = await getCurrentMember(currentUser.$id);

      // Check if professional profile exists
      let hasProProfile = false;
      if (currentMember?.role === "professional") {
        try {
          const proRes = await databases.listDocuments(
            DATABASE_ID,
            PROFESSIONALS_TABLE_ID,
            [Query.equal("userId", currentUser.$id), Query.limit(1)]
          );
          hasProProfile = proRes.documents.length > 0;
        } catch {
          hasProProfile = false;
        }
      }

      // Calculate profile completion
      let completion = 0;
      if (currentMember) {
        if (currentMember.fullName?.trim()) completion += 25;
        if (currentMember.phone?.trim()) completion += 25;
        if (currentMember.role) completion += 25;
        if (currentMember.profileImage) completion += 25;

        if (currentMember.profileCompletion !== completion) {
          try {
            await updateMemberProfileCompletion(currentMember.$id, completion);
            currentMember.profileCompletion = completion;
          } catch (err) {
            console.warn("Could not sync completion:", err);
          }
        }
      }

      // Resolve profile image URL
      let resolvedImgUrl: string | undefined = undefined;
      if (currentMember?.profileImage) {
        try {
          const url = getProfileImageUrl(currentMember.profileImage);
          resolvedImgUrl = url.toString();
        } catch {
          resolvedImgUrl = currentMember.profileImage;
        }
      }

      // Synchronize into Zustand AuthStore
      setUser({
        userId: currentUser.$id,
        memberId: currentMember?.$id || currentUser.$id,
        fullName: currentMember?.fullName?.trim() || currentUser.name?.trim() || "User",
        email: currentUser.email || "",
        role: (currentMember?.role as AuthRole) || "customer",
        profileImage: resolvedImgUrl,
      });

      return {
        user: currentUser,
        member: currentMember,
        hasProfessionalProfile: hasProProfile,
        profileImage: resolvedImgUrl,
        completion,
      };
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  /* ==========================================================
     TANSTACK QUERY: LIVE UNREAD NOTIFICATIONS COUNT
  ========================================================== */
  const activeUserId = dashboardData?.user?.$id || storedUser?.userId;
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
        try {
          const fallbackRes = await databases.listDocuments(
            DATABASE_ID,
            NOTIFICATIONS_TABLE_ID,
            [Query.equal("userId", activeUserId), Query.equal("status", "unread")]
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

  const user = dashboardData?.user;
  const member = dashboardData?.member;
  const profileImage = dashboardData?.profileImage || storedUser?.profileImage;
  const hasProfessionalProfile = dashboardData?.hasProfessionalProfile ?? false;

  /* ==========================================================
     DERIVED ATTRIBUTES
  ========================================================== */
  const fullName = storedUser?.fullName || member?.fullName?.trim() || user?.name?.trim() || "User";
  const firstName = fullName.split(" ")[0] || "User";
  const role = storedUser?.role || member?.role || "customer";
  const phone = member?.phone || "+91 8765879760";
  const email = storedUser?.email || user?.email || "user@homemate.com";
  const verificationStatus = member?.verificationStatus || "Approved";
  const profileCompletion = member?.profileCompletion ?? 100;

  const memberSince = useMemo(() => {
    const raw = member?.$createdAt || user?.$createdAt;
    if (!raw) return "12 Sept 2026";
    try {
      return new Date(raw).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "12 Sept 2026";
    }
  }, [member?.$createdAt, user?.$createdAt]);

  const initials = useMemo(() => {
    return (
      fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p.charAt(0).toUpperCase())
        .join("") || "HM"
    );
  }, [fullName]);

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
      background: "#ffffff",
      color: "#0f172a",
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

  /* ==========================================================
     LOADING / ERROR STATES
  ========================================================== */
  if (isLoading && !storedUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Loading HomeMate...
          </p>
        </div>
      </main>
    );
  }

  if (isError && !storedUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-xl font-bold text-rose-500">
            !
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Unable to load dashboard
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Session could not be retrieved. Please check your network or login again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => refetch()}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              Retry
            </button>
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Go to Login
            </Link>
          </div>
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
            {role.toUpperCase()} PORTAL
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
              {profileImage ? (
                <img
                  src={profileImage}
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
                {email}
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

      {/* Main Dashboard Grid */}
      <main className="p-4 sm:p-6 lg:ml-64">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Main Content Area */}
          <div className="xl:col-span-8 space-y-6">
            {/* Hero Welcome Card */}
            <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-blue-100/40 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div className="max-w-md">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                    Welcome back, {firstName}! <span className="inline-block animate-bounce">👋</span>
                  </h1>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    Manage your HomeMate account, profile and verification status from one place.
                  </p>
                  <p className="mt-3 text-xs italic font-semibold text-blue-800/80">
                    “A well-maintained home is a happier home.”
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center rounded-2xl bg-white/90 p-4 border border-white/80 shadow-sm backdrop-blur shrink-0">
                  <span className="text-4xl">🏡</span>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Your Home, Our Care
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Top KPI Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold">
                    👥
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      ACCOUNT TYPE
                    </p>
                    <p className="text-base font-black capitalize text-slate-900">
                      {role}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[11px] font-medium text-slate-400">
                  Your HomeMate role
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
                    <span className="text-xs font-black">{profileCompletion}%</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      PROFILE COMPLETION
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black text-slate-900">
                        {profileCompletion}%
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600">
                        ✓ Complete
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{ width: `${profileCompletion}%` }}
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">
                    🛡️
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      KYC VERIFICATION
                    </p>
                    <p className="text-base font-black text-slate-900">
                      {verificationStatus}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[11px] font-medium text-slate-400">
                  Current account verification
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
                    📅
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      MEMBER SINCE
                    </p>
                    <p className="text-sm font-black text-slate-900">
                      {memberSince}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[11px] font-medium text-slate-400">
                  HomeMate membership
                </p>
              </div>
            </div>

            {/* Role-Based Workspace Sections */}
            {role === "customer" && (
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Home Management
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Access your properties and manage maintenance activities from one place.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/properties"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View All →
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Link
                    href="/dashboard/properties"
                    className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">🏡</span>
                        <span className="text-slate-300 group-hover:text-blue-600 transition">→</span>
                      </div>
                      <h4 className="mt-3 text-sm font-black text-slate-900 group-hover:text-blue-600">
                        My Properties
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        View, add and manage your registered homes, apartments, offices and other properties.
                      </p>
                    </div>
                    <div className="mt-4 flex h-20 w-full items-center justify-center rounded-xl bg-blue-50/60 overflow-hidden">
                      <span className="text-3xl">🏠🌳</span>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/maintenance"
                    className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">🔧</span>
                        <span className="text-slate-300 group-hover:text-blue-600 transition">→</span>
                      </div>
                      <h4 className="mt-3 text-sm font-black text-slate-900 group-hover:text-blue-600">
                        Maintenance
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Track repairs, servicing, maintenance costs, upcoming work and maintenance history.
                      </p>
                    </div>
                    <div className="mt-4 flex h-20 w-full items-center justify-center rounded-xl bg-indigo-50/60 overflow-hidden">
                      <span className="text-3xl">⚙️👨‍🔧</span>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/bookings/new"
                    className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">🛠️</span>
                        <span className="text-slate-300 group-hover:text-blue-600 transition">→</span>
                      </div>
                      <h4 className="mt-3 text-sm font-black text-slate-900 group-hover:text-blue-600">
                        Book a Service
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Choose a professional service, select your property, preferred date and time, and submit a service request.
                      </p>
                    </div>
                    <div className="mt-4 flex h-20 w-full items-center justify-center rounded-xl bg-amber-50/60 overflow-hidden">
                      <span className="text-3xl">👷‍♂️🔨</span>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/bookings"
                    className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">📋</span>
                        <span className="text-slate-300 group-hover:text-blue-600 transition">→</span>
                      </div>
                      <h4 className="mt-3 text-sm font-black text-slate-900 group-hover:text-blue-600">
                        My Bookings
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        View your service requests, track booking status and manage your professional service bookings.
                      </p>
                    </div>
                    <div className="mt-4 flex h-20 w-full items-center justify-center rounded-xl bg-teal-50/60 overflow-hidden">
                      <span className="text-3xl">📅✨</span>
                    </div>
                  </Link>
                </div>
              </div>
            )}

            {/* Customer Marketplace */}
            {role === "customer" && (
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="text-base font-black text-slate-900">
                  Shop for your home
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 mb-4">
                  Browse home-maintenance products, manage your orders and stay updated with marketplace activity.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Link
                    href="/dashboard/marketplace"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">🛒</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">Marketplace</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Browse home-maintenance products available from HomeMate businesses and find products for your home.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-blue-600">
                      Browse Marketplace →
                    </span>
                  </Link>

                  <Link
                    href="/dashboard/marketplace/orders"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">📦</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">My Orders</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        View your marketplace orders, check order details and track the current status of your purchases.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-blue-600">
                      View My Orders →
                    </span>
                  </Link>

                  <Link
                    href="/dashboard/notifications"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">🔔</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">Marketplace Notifications</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        View order updates, delivery notifications and other important HomeMate marketplace announcements.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-blue-600">
                      View Notifications →
                    </span>
                  </Link>
                </div>
              </div>
            )}

            {/* Business Marketplace */}
            {role === "business" && (
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="text-base font-black text-slate-900">
                  Manage your marketplace
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 mb-4">
                  Add and manage the home-maintenance products your business offers to HomeMate customers.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Link
                    href="/dashboard/marketplace/products"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">🛒</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">My Products</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        View, edit and manage the products listed by your business in the HomeMate marketplace.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-blue-600">
                      Manage Products →
                    </span>
                  </Link>

                  <Link
                    href="/dashboard/marketplace/business-orders"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">📦</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">Customer Orders</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        View customer orders for your products and manage their order status.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-blue-600">
                      Manage Orders →
                    </span>
                  </Link>

                  <Link
                    href="/dashboard/marketplace/products/add"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">＋</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">Add Product</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Publish a new cleaning, electrical, plumbing, home-tool, smart-home or maintenance product.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-blue-600">
                      Add New Product →
                    </span>
                  </Link>
                </div>
              </div>
            )}

            {/* Module 5.7: Maintenance & Service History */}
            {(role === "customer" || role === "professional") && (
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      MODULE 5.7
                    </p>
                    <h3 className="text-base font-black text-slate-900">
                      Maintenance & Service History
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Manage service records, maintenance history, invoices and warranty information.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/service-history"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View All →
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Service History */}
                  <Link
                    href="/dashboard/service-history"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                  >
                    <div>
                      <span className="text-xl">📋</span>
                      <h4 className="mt-2 text-xs font-black text-slate-900">Service History</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {role === "customer"
                          ? "View previous bookings, completed services, maintenance records, invoices, professional details and warranties."
                          : "Review completed service records, customer service history, invoices and warranty information."}
                      </p>
                    </div>
                    <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                      Open Service History →
                    </span>
                  </Link>

                  {/* Customer: Maintenance & Upcoming Work */}
                  {role === "customer" && (
                    <Link
                      href="/dashboard/maintenance"
                      className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                    >
                      <div>
                        <span className="text-xl">🔧</span>
                        <h4 className="mt-2 text-xs font-black text-slate-900">
                          Maintenance & Upcoming Work
                        </h4>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Track property maintenance history, repairs, servicing, maintenance costs and upcoming maintenance work.
                        </p>
                      </div>
                      <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                        Manage Maintenance →
                      </span>
                    </Link>
                  )}

                  {/* Customer: Invoices & Warranty (Routes to /dashboard/warranties) */}
                  {role === "customer" && (
                    <Link
                      href="/dashboard/warranties"
                      className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                    >
                      <div>
                        <span className="text-xl">🧾</span>
                        <h4 className="mt-2 text-xs font-black text-slate-900">
                          Invoices & Warranty
                        </h4>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Access service invoices and view warranty coverage, expiry dates, status and warranty terms recorded by professionals.
                        </p>
                      </div>
                      <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                        View Invoices & Warranty →
                      </span>
                    </Link>
                  )}

                  {/* Professional: Warranty Management */}
                  {role === "professional" && (
                    <Link
                      href="/dashboard/warranties/new"
                      className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                    >
                      <div>
                        <span className="text-xl">🛡️</span>
                        <h4 className="mt-2 text-xs font-black text-slate-900">
                          Warranty Management
                        </h4>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Add warranty period, coverage dates, terms and status for your completed customer services.
                        </p>
                      </div>
                      <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                        Add Warranty →
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Communication */}
            {role === "customer" && (
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="text-base font-black text-slate-900">
                  Stay connected
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 mb-4">
                  Chat with professionals and keep track of your latest HomeMate notifications.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Link
                    href="/dashboard/messages"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-purple-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">💬</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">Messages</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Chat with your home-service professionals and continue your conversations from one place.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-purple-600">
                      Open Messages →
                    </span>
                  </Link>

                  <Link
                    href="/dashboard/notifications"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-amber-200 hover:bg-white"
                  >
                    <div>
                      <span className="text-2xl">🔔</span>
                      <h4 className="mt-2 text-sm font-black text-slate-900">Notifications</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        View booking updates, reminders, order notifications and important HomeMate announcements.
                      </p>
                    </div>
                    <span className="mt-4 inline-block text-xs font-bold text-amber-600">
                      View Notifications →
                    </span>
                  </Link>
                </div>
              </div>
            )}

            {/* Professional Services */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  PROFESSIONAL SERVICES
                </p>
                <h3 className="text-base font-black text-slate-900">
                  Discover & manage services
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Find nearby professionals or manage your professional services from one place.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link
                  href="/dashboard/professionals"
                  className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                >
                  <div>
                    <span className="text-xl">🔍</span>
                    <h4 className="mt-2 text-xs font-black text-slate-900">Find Professionals</h4>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Discover nearby home-service professionals using location, category, rating, availability and price filters.
                    </p>
                  </div>
                  <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                    Explore Professionals →
                  </span>
                </Link>

                {role === "professional" && (
                  <Link
                    href="/dashboard/professionals/services"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                  >
                    <div>
                      <span className="text-xl">🛠️</span>
                      <h4 className="mt-2 text-xs font-black text-slate-900">My Services</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Create, edit and manage the professional services you offer to HomeMate customers.
                      </p>
                    </div>
                    <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                      Manage My Services →
                    </span>
                  </Link>
                )}

                {role === "professional" && (
                  <Link
                    href="/dashboard/professional-bookings"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                  >
                    <div>
                      <span className="text-xl">📋</span>
                      <h4 className="mt-2 text-xs font-black text-slate-900">Incoming Bookings</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Review customer requests and update booking status from Requested to Completed.
                      </p>
                    </div>
                    <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                      Manage Bookings →
                    </span>
                  </Link>
                )}

                {role === "professional" && hasProfessionalProfile && (
                  <Link
                    href="/dashboard/professionals/service-area"
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:border-blue-200"
                  >
                    <div>
                      <span className="text-xl">📍</span>
                      <h4 className="mt-2 text-xs font-black text-slate-900">Manage Service Area</h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Set your service location, coverage area and location visibility for customers.
                      </p>
                    </div>
                    <span className="mt-3 inline-block text-[10px] font-bold text-blue-600">
                      Manage Service Area →
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar Widgets */}
          <div className="xl:col-span-4 space-y-6">
            {/* Profile Overview */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🪪</span>
                  <h3 className="text-sm font-black text-slate-900">
                    Profile Overview
                  </h3>
                </div>
                <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400">
                  {role}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-5">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-blue-100 bg-blue-50 shadow-sm">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-black text-lg text-blue-600 bg-blue-100">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-base font-black text-slate-900">
                    {fullName}
                  </h4>
                  <p className="truncate text-xs text-slate-400">
                    {email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                      {role}
                    </span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                      {verificationStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3.5 border-t border-slate-100 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Full Name</span>
                  <span className="font-bold text-slate-900">{fullName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Phone</span>
                  <span className="font-bold text-slate-900">{phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Email</span>
                  <span className="font-bold text-slate-900 truncate max-w-[170px]">
                    {email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Role</span>
                  <span className="font-bold capitalize text-slate-900">{role}</span>
                </div>
              </div>

              {role === "professional" && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-900">
                    Professional verification
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    License and certificate verification will be managed through the professional verification process.
                  </p>
                  <Link
                    href="/dashboard/verification"
                    className="mt-3 block w-full rounded-xl border border-slate-200 py-2.5 text-center text-xs font-bold text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition"
                  >
                    View Verification →
                  </Link>
                </div>
              )}
            </div>

            {/* Account Access & Security */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="text-sm">🔒</span>
                <h3 className="text-sm font-black text-slate-900">
                  Account Access
                </h3>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Authentication</p>
                    <p className="text-[10px] text-slate-400">Appwrite Authentication</p>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="font-bold text-slate-800">Account Session</p>
                    <p className="text-[10px] text-slate-400">Currently signed in</p>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Capabilities Matrix */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 mb-4">
                Your Account Capabilities
              </h3>

              <div className="space-y-3 text-xs">
                <div
                  className={`rounded-2xl border p-3.5 transition ${
                    role === "customer"
                      ? "border-blue-200 bg-blue-50/40"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>🏠</span> Homeowner
                    </span>
                    {role === "customer" && (
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                        Your Role
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    Manage your HomeMate account and access home-service features designed for homeowners.
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-3.5 transition ${
                    role === "professional"
                      ? "border-blue-200 bg-blue-50/40"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>🧰</span> Professional
                    </span>
                    {role === "professional" && (
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                        Your Role
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    Build your professional profile and complete the verification process to establish trust.
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-3.5 transition ${
                    role === "business"
                      ? "border-blue-200 bg-blue-50/40"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>🏢</span> Business
                    </span>
                    {role === "business" && (
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                        Your Role
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                    Establish your business account and prepare your organization for HomeMate services.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Universal Page Footer */}
        <footer className="mt-12 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/80 pt-6 text-xs text-slate-400 gap-3">
          <p>HomeMate • Home Services & Community Platform</p>
          <p>Secure Account Dashboard</p>
        </footer>
      </main>
    </div>
  );
}