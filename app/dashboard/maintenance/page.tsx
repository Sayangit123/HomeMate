"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import {
  deleteMaintenance,
  getUserMaintenance,
  MaintenanceStatus,
} from "@/lib/appwrite/maintenance";
import { getUserProperties } from "@/lib/appwrite/property";
import { getProfileImageUrl, getPropertyImageUrl } from "@/lib/appwrite/storage";
import { getCurrentMember } from "@/lib/appwrite/database";
import { useMaintenanceStore } from "@/lib/stores/maintenance-store";
import { useAuthStore } from "@/lib/stores/auth-store";

/* ============================================================
   TYPES & APPWRITE CLIENT
============================================================ */

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Property {
  $id: string;
  propertyName: string;
  location?: string | null;
  address?: string;
  propertyImages?: string | null;
}

interface MaintenanceRecord {
  $id: string;
  propertyId: string;
  title: string;
  category: string;
  description?: string | null;
  maintenanceDate: string;
  status: MaintenanceStatus;
  cost?: number | null;
  providerName?: string | null;
  notes?: string | null;
}

export default function MaintenancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Zustand Auth Store
  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  // Zustand Maintenance Filter Store
  const {
    search,
    statusFilter,
    categoryFilter,
    setSearch,
    setStatusFilter,
    setCategoryFilter,
  } = useMaintenanceStore();

  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState("All");

  /* ==========================================================
     LOAD MAINTENANCE & PROPERTIES
  ========================================================== */
  const maintenanceQuery = useQuery({
    queryKey: ["maintenance"],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error("Unauthenticated user");

      const [maintenanceResponse, propertiesResponse] = await Promise.all([
        getUserMaintenance(user.$id),
        getUserProperties(user.$id),
      ]);

      return {
        maintenance: maintenanceResponse.documents as unknown as MaintenanceRecord[],
        properties: propertiesResponse.documents as unknown as Property[],
      };
    },
    staleTime: 30 * 1000,
  });

  const maintenance = maintenanceQuery.data?.maintenance || [];
  const properties = maintenanceQuery.data?.properties || [];
  const loading = maintenanceQuery.isLoading;

  /* ==========================================================
     LOAD USER NAVBAR DETAILS & NOTIFICATIONS
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
     ERROR HANDLER
  ========================================================== */
  useEffect(() => {
    if (maintenanceQuery.isError) {
      console.error("Failed to load maintenance:", maintenanceQuery.error);
      Swal.fire({
        icon: "error",
        title: "Unable to load maintenance",
        text: "Please refresh the page and try again.",
        confirmButtonColor: "#0f172a",
      });
    }
  }, [maintenanceQuery.isError, maintenanceQuery.error]);

  /* ==========================================================
     PROPERTY HELPERS
  ========================================================== */
  const getPropertyObj = (propertyId: string) => {
    return properties.find((item) => item.$id === propertyId);
  };

  const getPropertyName = (propertyId: string) => {
    return getPropertyObj(propertyId)?.propertyName || "My Home";
  };

  const getPropertyLocation = (propertyId: string) => {
    const prop = getPropertyObj(propertyId);
    return prop?.location || prop?.address || "Kestopur, Kolkata";
  };

  const getPropertyImage = (propertyId: string) => {
    const prop = getPropertyObj(propertyId);
    if (!prop?.propertyImages) return null;
    try {
      const parsed = JSON.parse(prop.propertyImages);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return getPropertyImageUrl(parsed[0]).toString();
      }
    } catch {
      return null;
    }
    return null;
  };

  const formatDate = (date: string) => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return date;
    }
  };

  /* ==========================================================
     FILTERING
  ========================================================== */
  const filteredMaintenance = useMemo(() => {
    return maintenance.filter((item) => {
      const searchText = search.toLowerCase();
      const matchesSearch =
        item.title.toLowerCase().includes(searchText) ||
        item.category.toLowerCase().includes(searchText) ||
        getPropertyName(item.propertyId).toLowerCase().includes(searchText) ||
        (item.providerName || "").toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;

      const matchesCategory =
        categoryFilter === "All" || item.category === categoryFilter;

      const matchesProperty =
        selectedPropertyFilter === "All" || item.propertyId === selectedPropertyFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesProperty;
    });
  }, [
    maintenance,
    properties,
    search,
    statusFilter,
    categoryFilter,
    selectedPropertyFilter,
  ]);

  /* ==========================================================
     STATISTICS
  ========================================================== */
  const totalRecords = maintenance.length;
  const pendingCount = maintenance.filter((item) => item.status === "Pending").length;
  const inProgressCount = maintenance.filter((item) => item.status === "InProgress").length;
  const completedCount = maintenance.filter((item) => item.status === "Completed").length;
  const totalCost = maintenance.reduce(
    (total, item) => total + Number(item.cost || 0),
    0
  );

  /* ==========================================================
     STATUS BADGE STYLES
  ========================================================== */
  const renderStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-200">
            <span>⏳</span>
            <span>Pending</span>
          </span>
        );
      case "InProgress":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 border border-blue-200">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>In Progress</span>
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-200">
            <span>✓</span>
            <span>Completed</span>
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 border border-rose-200">
            <span>✕</span>
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  /* ==========================================================
     DELETE MUTATION
  ========================================================== */
  const deleteMaintenanceMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      await deleteMaintenance(maintenanceId);
      return maintenanceId;
    },
    onSuccess: async (maintenanceId) => {
      queryClient.setQueryData(
        ["maintenance"],
        (
          current:
            | {
                maintenance: MaintenanceRecord[];
                properties: Property[];
              }
            | undefined
        ) => {
          if (!current) return current;
          return {
            ...current,
            maintenance: current.maintenance.filter((item) => item.$id !== maintenanceId),
          };
        }
      );

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: "Maintenance record deleted successfully.",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (err) => {
      console.error("Failed to delete maintenance:", err);
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: "Unable to delete this maintenance record.",
      });
    },
  });

  const handleDelete = async (maintenanceId: string) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete maintenance record?",
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#94a3b8",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;
    deleteMaintenanceMutation.mutate(maintenanceId);
  };

  /* ==========================================================
     LOGOUT
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

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setCategoryFilter("All");
    setSelectedPropertyFilter("All");
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Mobile Drawer */}
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
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <span className="text-base">🏘️</span>
            <span>My Properties</span>
          </Link>
          <Link
            href="/dashboard/maintenance"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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

      {/* Desktop Navy Sidebar */}
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
            MAINTENANCE MANAGEMENT
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
        {/* Navigation Breadcrumb */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </Link>

        {/* ========================================================
            HERO PROMOTIONAL BANNER
        ======================================================== */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-100 via-sky-50 to-blue-50 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                PROPERTY MANAGEMENT
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                Maintenance Management
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
                Track repairs, servicing, maintenance costs and service providers across your properties.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard/maintenance/history")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                <span>⏱️</span>
                <span>Maintenance History</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/maintenance/upcoming")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                <span>📅</span>
                <span>Upcoming Maintenance</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/maintenance/add")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
              >
                <span>+</span>
                <span>Add Maintenance</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            5 STAT KPI CARDS
        ======================================================== */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Total Records */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
              📄
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{totalRecords}</p>
              <p className="text-xs font-bold text-slate-700">Total Records</p>
              <p className="text-[10px] text-slate-400">All maintenance activities</p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
              ⏳
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{pendingCount}</p>
              <p className="text-xs font-bold text-slate-700">Pending</p>
              <p className="text-[10px] text-slate-400">Needs attention</p>
            </div>
          </div>

          {/* In Progress */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
              ⚙️
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{inProgressCount}</p>
              <p className="text-xs font-bold text-slate-700">In Progress</p>
              <p className="text-[10px] text-slate-400">Currently being serviced</p>
            </div>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
              ✓
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{completedCount}</p>
              <p className="text-xs font-bold text-slate-700">Completed</p>
              <p className="text-[10px] text-slate-400">Successfully finished</p>
            </div>
          </div>

          {/* Total Cost */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">
              💰
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">
                ₹{totalCost.toLocaleString("en-IN")}
              </p>
              <p className="text-xs font-bold text-slate-700">Total Cost</p>
              <p className="text-[10px] text-slate-400">Across all properties</p>
            </div>
          </div>
        </div>

        {/* ========================================================
            FILTERS ROW
        ======================================================== */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            {/* In-page Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search maintenance..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none transition"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="InProgress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none transition"
            >
              <option value="All">All Categories</option>
              <option value="General">General</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Cleaning">Cleaning</option>
              <option value="AC">AC</option>
              <option value="Appliance">Appliance</option>
              <option value="Painting">Painting</option>
              <option value="Pest Control">Pest Control</option>
              <option value="Other">Other</option>
            </select>

            {/* Property Selector */}
            <select
              value={selectedPropertyFilter}
              onChange={(e) => setSelectedPropertyFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none transition"
            >
              <option value="All">All Properties</option>
              {properties.map((prop) => (
                <option key={prop.$id} value={prop.$id}>
                  {prop.propertyName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
          >
            <span>🧹</span>
            <span>Clear Filters</span>
          </button>
        </div>

        {/* ========================================================
            RECORDS TABLE CARD
        ======================================================== */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 p-6">
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Maintenance Records
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {filteredMaintenance.length}{" "}
              {filteredMaintenance.length === 1 ? "record" : "records"} found
            </p>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mx-auto" />
              <p className="mt-3 text-xs font-bold text-slate-400">
                Loading maintenance records...
              </p>
            </div>
          ) : filteredMaintenance.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
                🔧
              </div>
              <h3 className="text-base font-black text-slate-900">
                No maintenance records
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
                {maintenance.length === 0
                  ? "Start tracking your property maintenance by creating your first record."
                  : "No records match your current search or active filters."}
              </p>
              {maintenance.length === 0 && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/maintenance/add")}
                  className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
                >
                  + Add First Record
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">MAINTENANCE</th>
                    <th className="px-6 py-4">PROPERTY</th>
                    <th className="px-6 py-4">CATEGORY</th>
                    <th className="px-6 py-4">DATE</th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4">COST</th>
                    <th className="px-6 py-4 text-center">ACTIONS</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredMaintenance.map((item, index) => {
                    const propImg = getPropertyImage(item.propertyId);

                    return (
                      <tr key={item.$id} className="hover:bg-slate-50/60 transition">
                        <td className="px-6 py-4 text-slate-400 font-bold">{index + 1}</td>

                        {/* Title & Provider */}
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.providerName || "Service Provider"}
                          </p>
                        </td>

                        {/* Property Image & Details */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                              {propImg ? (
                                <img
                                  src={propImg}
                                  alt="Property"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-base">
                                  🏠
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">
                                {getPropertyName(item.propertyId)}
                              </p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <span>📍</span>
                                <span>{getPropertyLocation(item.propertyId)}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Category Badge */}
                        <td className="px-6 py-4">
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-600 border border-blue-100">
                            {item.category}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {formatDate(item.maintenanceDate)}
                        </td>

                        {/* Status Pill */}
                        <td className="px-6 py-4">{renderStatusBadge(item.status)}</td>

                        {/* Cost */}
                        <td className="px-6 py-4 font-black text-slate-900 text-sm">
                          ₹{Number(item.cost || 0).toLocaleString("en-IN")}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/maintenance/${item.$id}`)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition shadow-sm"
                            >
                              <span>👁️</span>
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/maintenance/${item.$id}/edit`)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(item.$id)}
                              disabled={deleteMaintenanceMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-sm disabled:opacity-50"
                            >
                              <span>🗑️</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table Pagination Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
                <p>
                  Showing 1 to {filteredMaintenance.length} of {filteredMaintenance.length} records
                </p>
                <div className="flex items-center gap-1">
                  <button
                    disabled
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-300 disabled:opacity-50"
                  >
                    ❮
                  </button>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                    1
                  </span>
                  <button
                    disabled
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-300 disabled:opacity-50"
                  >
                    ❯
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}