"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import {
  getProfessionalByUserId,
  updateProfessionalServiceArea,
  updateProfessional,
} from "@/lib/appwrite/professional";
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
      <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-400">
        Loading map preview...
      </div>
    ),
  }
);

interface Professional {
  $id: string;
  userId: string;
  professionalName: string;
  serviceArea?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVisibility?: boolean;
}

export default function ServiceAreaPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [serviceArea, setServiceArea] = useState("");
  const [locationVisibility, setLocationVisibility] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [navbarSearch, setNavbarSearch] = useState("");

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
        name: member?.fullName?.trim() || currentUser.name?.trim() || "User",
        email: currentUser.email || "",
        role: member?.role || "professional",
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

  /* Load logged-in professional */
  useEffect(() => {
    const loadProfessional = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        const professionalData = await getProfessionalByUserId(user.$id);

        if (!professionalData) {
          await Swal.fire({
            icon: "warning",
            title: "Professional profile not found",
            text: "Your professional profile could not be found.",
          });
          router.push("/dashboard");
          return;
        }

        const data = professionalData as unknown as Professional;
        setProfessional(data);
        setServiceArea(data.serviceArea ?? "");
        setLocationVisibility(data.locationVisibility !== false);
      } catch (error) {
        console.error("Failed to load professional:", error);
        await Swal.fire({
          icon: "error",
          title: "Unable to load profile",
          text: "Something went wrong while loading your professional profile.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfessional();
  }, [router]);

  /* Save service area */
  const handleSave = async () => {
    if (!professional) return;

    const trimmedArea = serviceArea.trim();

    if (!trimmedArea) {
      await Swal.fire({
        icon: "warning",
        title: "Service area required",
        text: "Please enter the area where you provide your services.",
      });
      return;
    }

    if (trimmedArea.length < 3) {
      await Swal.fire({
        icon: "warning",
        title: "Invalid service area",
        text: "Service area should contain at least 3 characters.",
      });
      return;
    }

    try {
      setSaving(true);
      const updated = await updateProfessionalServiceArea(
        professional.$id,
        trimmedArea
      );
      const updatedProfessional = updated as unknown as Professional;

      setProfessional(updatedProfessional);
      setServiceArea(updatedProfessional.serviceArea ?? "");

      await Swal.fire({
        icon: "success",
        title: "Service area updated",
        text: "Your service area has been successfully updated.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Failed to update service area:", error);
      await Swal.fire({
        icon: "error",
        title: "Update failed",
        text: "Unable to update your service area. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  /* Update location visibility */
  const handleLocationVisibilityChange = async (visible: boolean) => {
    if (!professional) return;

    try {
      setSavingPrivacy(true);
      const updated = await updateProfessional(professional.$id, {
        locationVisibility: visible,
      });
      const updatedProfessional = updated as unknown as Professional;

      setProfessional(updatedProfessional);
      setLocationVisibility(updatedProfessional.locationVisibility !== false);

      await Swal.fire({
        icon: "success",
        title: visible ? "Location visibility enabled" : "Location visibility disabled",
        text: visible
          ? "Your professional location can now appear on the discovery map."
          : "Your exact professional location is now hidden from the discovery map.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Failed to update location visibility:", error);
      setLocationVisibility(professional.locationVisibility !== false);
      await Swal.fire({
        icon: "error",
        title: "Update failed",
        text: "Unable to update your location privacy setting. Please try again.",
      });
    } finally {
      setSavingPrivacy(false);
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

  if (!mounted || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">
            Loading professional profile...
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
          <Link href="/dashboard/professionals" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md">
            <span>👤</span><span>Professionals</span>
          </Link>
          <Link href="/dashboard/properties" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>🏘️</span><span>My Properties</span>
          </Link>
          <Link href="/dashboard/maintenance" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition">
            <span>🔧</span><span>Maintenance</span>
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
          <Link href="/dashboard/marketplace" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span>🛒</span><span>Marketplace</span>
          </Link>
          <Link href="/dashboard/professionals" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30">
            <span>👤</span><span>Professionals</span>
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
              🏡
            </div>
            <h4 className="text-xs font-black text-white leading-tight">
              Grow Your Business<br />with HomeMate
            </h4>
            <p className="mt-1 text-[10px] text-slate-400">
              Reach more customers in your service area.
            </p>
            <Link
              href="/dashboard/professionals"
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
              placeholder="Search customers, bookings, services..."
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
              <p className="text-[10px] font-medium text-slate-400">Professional</p>
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
            <Link href="/dashboard/professionals" className="flex items-center gap-1 hover:text-slate-700">
              <span>← Back to Professionals</span>
            </Link>
          </div>
        </div>

        {/* Hero Banner Card */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-100/40 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
                PROFESSIONAL SETTINGS
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                Service Area Management
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Manage the locations where you provide your professional services. Customers can use this information to find professionals near them.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-4 rounded-2xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg">
                📍
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Be Visible, Get More Bookings</p>
                <p className="text-[11px] text-slate-500">Set your service areas to connect with customers near you.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Header Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">{professional?.professionalName || "Rahul Plumbing Solutions"}</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-200">
                  ✓ Verified Professional
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Plumbing • Repair • Installation • Maintenance</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
              📍
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Service Area</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">1</p>
              <p className="text-[10px] text-emerald-600 font-bold">Currently active</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
              ★
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Average Rating</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">4.8 / 5.0</p>
              <p className="text-[10px] text-slate-400">From customers</p>
            </div>
          </div>
        </div>

        {/* MAIN BODY GRID: FORM & INTERACTIVE MAP PREVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* SERVICE AREA FORM (7 Cols) */}
          <section className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-black text-slate-900">Your Service Area</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter the city, neighbourhood, locality, or group of areas where you provide services.
              </p>
            </div>

            {/* Current Area Badge */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Current Service Area</p>
              <p className="text-xs font-black text-slate-800 mt-1">
                {professional?.serviceArea || "No service area has been set yet."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Select City</label>
                <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition">
                  <option>Kolkata</option>
                  <option>Howrah</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Select Area Type</label>
                <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition">
                  <option>Locality</option>
                  <option>Entire City</option>
                </select>
              </div>
            </div>

            {/* Textarea Input */}
            <div>
              <label htmlFor="serviceArea" className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Service Area Description
              </label>
              <textarea
                id="serviceArea"
                value={serviceArea}
                onChange={(event) => setServiceArea(event.target.value)}
                placeholder="Example: Salt Lake, New Town, Rajarhat, Howrah, etc."
                rows={4}
                maxLength={255}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition resize-none shadow-sm"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Examples: Salt Lake, New Town, Rajarhat, Howrah, etc.</span>
                <span className="font-bold">{serviceArea.length}/255</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-center text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "💾 Save Service Area"}
              </button>

              <button
                type="button"
                onClick={() => setServiceArea(professional?.serviceArea ?? "")}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
              >
                Reset ↺
              </button>
            </div>
          </section>

          {/* SERVICE AREA PREVIEW INTERACTIVE MAP (5 Cols) */}
          <section className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Service Area Preview</h3>
              <p className="text-xs text-slate-500">This is how your service area will appear to customers.</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <ProfessionalMap
                professionals={professional ? [professional as any] : []}
                selectedProfessional={professional as any}
                onSelectProfessional={() => {}}
              />
            </div>

            <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <span>Your service area ({professional?.serviceArea || "Kolkata Region"})</span>
            </p>
          </section>
        </div>

        {/* ========================================================
            LOCATION PRIVACY SECTION
        ======================================================== */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">LOCATION PRIVACY</span>
              <h2 className="text-lg font-black text-slate-900">Location Visibility</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control whether your professional location can be displayed on the customer discovery map.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={locationVisibility}
              onClick={() => handleLocationVisibilityChange(!locationVisibility)}
              disabled={savingPrivacy}
              className={`relative h-7 w-14 rounded-full border transition-colors ${
                locationVisibility ? "bg-blue-600 border-blue-600" : "bg-slate-300 border-slate-300"
              } ${savingPrivacy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                  locationVisibility ? "translate-x-7" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Current Status</p>
              <p className={`text-sm font-black mt-0.5 ${locationVisibility ? "text-emerald-600" : "text-amber-600"}`}>
                {locationVisibility ? "Location Visible" : "Location Hidden"}
              </p>
            </div>
            <span className="text-2xl">{locationVisibility ? "📍" : "🔒"}</span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            {locationVisibility
              ? "Your location is currently visible to customers through the professional discovery map."
              : "Your location is currently hidden. Customers will not see your location marker on the discovery map."}
          </p>
        </section>

        {/* CURRENT SERVICE AREAS TABLE / LIST */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">Current Service Areas</h2>

          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-blue-600 text-lg">📍</span>
              <div>
                <p className="text-xs font-black text-slate-900">{professional?.serviceArea || "Howrah & Kolkata"}</p>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600 border border-emerald-200 mt-1">
                  Active
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
                title="Edit Area"
              >
                ✏️
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}