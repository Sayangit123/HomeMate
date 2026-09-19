"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import {
  useServiceHistoryStore,
} from "@/lib/stores/service-history-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCustomerBookings } from "@/lib/appwrite/booking";
import { getUserProperties } from "@/lib/appwrite/property";
import { getServiceById } from "@/lib/appwrite/service";
import { getUserMaintenance, MaintenanceStatus } from "@/lib/appwrite/maintenance";
import { getCustomerWarranties } from "@/lib/appwrite/warranty";
import { getAllMembers } from "@/lib/appwrite/member";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";

/* ============================================================
   APPWRITE CONFIG & CONSTANTS
============================================================ */

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

/* ============================================================
   TYPES
============================================================ */

interface Property {
  $id: string;
  propertyName?: string;
  address?: string;
}

interface Service {
  $id: string;
  userId: string;
  serviceName: string;
  description?: string;
  duration: number;
  price: number;
}

interface Booking {
  $id: string;
  customerId: string;
  professionalId: string;
  serviceId: string;
  propertyId: string;
  bookingDate: string;
  bookingTime: string;
  status:
    | "Requested"
    | "Accepted"
    | "InProgress"
    | "Completed"
    | "Cancelled";
  notes?: string | null;
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

interface Warranty {
  $id: string;
  bookingId: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  professionalId: string;
  warrantyPeriod: string;
  warrantyStartDate: string;
  warrantyExpiryDate: string;
  warrantyTerms?: string | null;
  status: "Active" | "Expired" | "Claimed" | "Cancelled";
}

interface ProfessionalMember {
  $id: string;
  userId: string;
  fullName: string;
  phone?: string | null;
  role: "customer" | "professional" | "business";
  verificationStatus?: string;
}

interface BookingDetails {
  serviceName: string;
  price: number;
  duration: number;
  propertyName: string;
}

export default function ServiceHistoryPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [navbarSearch, setNavbarSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  const { activeSection, setActiveSection } = useServiceHistoryStore();

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
     TANSTACK QUERY: SERVICE HISTORY DATA
  ========================================================== */
  const serviceHistoryQuery = useQuery({
    queryKey: ["service-history"],
    queryFn: async () => {
      const user = await getCurrentUser();

      const [
        bookingResponse,
        propertyResponse,
        maintenanceResponse,
        warrantyResponse,
        professionalResponse,
      ] = await Promise.all([
        getCustomerBookings(user.$id),
        getUserProperties(user.$id),
        getUserMaintenance(user.$id),
        getCustomerWarranties(user.$id),
        getAllMembers(),
      ]);

      const customerBookings = bookingResponse.documents as unknown as Booking[];
      const customerProperties = propertyResponse.documents as unknown as Property[];
      const maintenanceRecords = maintenanceResponse.documents as unknown as MaintenanceRecord[];
      const customerWarranties = warrantyResponse.documents as unknown as Warranty[];
      const professionalMembers = (
        professionalResponse.documents as unknown as ProfessionalMember[]
      ).filter((member) => member.role === "professional");

      const details: Record<string, BookingDetails> = {};

      await Promise.all(
        customerBookings.map(async (booking) => {
          try {
            const service = (await getServiceById(booking.serviceId)) as unknown as Service;
            const property = customerProperties.find((item) => item.$id === booking.propertyId);

            details[booking.$id] = {
              serviceName: service.serviceName,
              price: Number(service.price || 0),
              duration: Number(service.duration || 0),
              propertyName: property?.propertyName || "My Home",
            };
          } catch (error) {
            details[booking.$id] = {
              serviceName: "Home Service",
              price: 1000,
              duration: 60,
              propertyName: "My Home",
            };
          }
        })
      );

      return {
        bookings: customerBookings,
        properties: customerProperties,
        maintenance: maintenanceRecords,
        warranties: customerWarranties,
        professionals: professionalMembers,
        bookingDetails: details,
      };
    },
    retry: 1,
    staleTime: 30 * 1000,
  });

  const bookings = serviceHistoryQuery.data?.bookings || [];
  const maintenance = serviceHistoryQuery.data?.maintenance || [];
  const warranties = serviceHistoryQuery.data?.warranties || [];
  const professionals = serviceHistoryQuery.data?.professionals || [];
  const properties = serviceHistoryQuery.data?.properties || [];
  const bookingDetails = serviceHistoryQuery.data?.bookingDetails || {};
  const loading = serviceHistoryQuery.isLoading;

  useEffect(() => {
    if (!serviceHistoryQuery.isError) return;
    void Swal.fire({
      icon: "error",
      title: "Unable to Load",
      text: "Unable to load your service history. Please refresh the page and try again.",
      confirmButtonColor: "#020617",
    });
  }, [serviceHistoryQuery.isError]);

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

      ["token", "accessToken", "authToken", "user", "userData", "role", "userRole"].forEach(
        (key) => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        }
      );

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
     HELPERS & DATA CALCULATIONS
  ========================================================== */
  const formatDate = (dateValue: string) => {
    if (!dateValue) return "—";
    try {
      return new Date(dateValue).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateValue;
    }
  };

  const formatTime = (timeValue: string) => {
    if (!timeValue) return "—";
    try {
      const date = new Date(`1970-01-01T${timeValue}`);
      if (Number.isNaN(date.getTime())) return timeValue;
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timeValue;
    }
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find((item) => item.$id === propertyId);
    return property?.propertyName || "My Home";
  };

  const getProfessionalDetails = (professionalId: string) => {
    return professionals.find((professional) => professional.userId === professionalId);
  };

  const completedBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "Completed");
  }, [bookings]);

  const upcomingBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === "Requested" ||
        booking.status === "Accepted"
    );
  }, [bookings]);

  const inProgressBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "InProgress");
  }, [bookings]);

  const cancelledBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "Cancelled");
  }, [bookings]);

  const totalCost = useMemo(() => {
    return bookings.reduce((sum, b) => {
      const det = bookingDetails[b.$id];
      return sum + Number(det?.price || 0);
    }, 0);
  }, [bookings, bookingDetails]);

  /* Filtered bookings based on selected status pill & navbar search */
  const filteredBookings = useMemo(() => {
    let list = [...bookings];

    if (selectedFilter === "Upcoming") {
      list = list.filter((b) => b.status === "Requested" || b.status === "Accepted");
    } else if (selectedFilter === "Completed") {
      list = list.filter((b) => b.status === "Completed");
    } else if (selectedFilter === "InProgress") {
      list = list.filter((b) => b.status === "InProgress");
    } else if (selectedFilter === "Cancelled") {
      list = list.filter((b) => b.status === "Cancelled");
    }

    if (navbarSearch.trim()) {
      const q = navbarSearch.toLowerCase();
      list = list.filter((b) => {
        const det = bookingDetails[b.$id];
        const prof = getProfessionalDetails(b.professionalId);
        return (
          det?.serviceName?.toLowerCase().includes(q) ||
          det?.propertyName?.toLowerCase().includes(q) ||
          prof?.fullName?.toLowerCase().includes(q) ||
          b.$id.toLowerCase().includes(q)
        );
      });
    }

    return list.sort((a, b) => {
      const timeA = new Date(`${a.bookingDate}T${a.bookingTime || "00:00"}`).getTime();
      const timeB = new Date(`${b.bookingDate}T${b.bookingTime || "00:00"}`).getTime();
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [bookings, selectedFilter, navbarSearch, sortBy, bookingDetails]);

  /* Status badge pill renderer */
  const renderStatusPill = (status: Booking["status"]) => {
    switch (status) {
      case "InProgress":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-600 border border-purple-200">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />
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
      case "Requested":
      case "Accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-200">
            <span>⏱️</span>
            <span>Upcoming</span>
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
            className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <span className="text-base">🛒</span>
            <span>Marketplace</span>
          </Link>

          <Link
            href="/dashboard/service-history"
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
              Your home<br />Our priority
            </h4>
            <p className="mt-1 text-[10px] text-slate-400">
              Reliable services for a better living.
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

      {/* Top Navbar with Searchbar */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur lg:ml-64 gap-4">
        {/* Left Side: Mobile Toggler & Global Search Bar */}
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
              placeholder="Search services, properties, or professionals..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm"
            />
          </div>
        </div>

        {/* Right Side: Notifications & User Profile */}
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
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-700">
              <span>🏠</span>
              <span>Home</span>
            </Link>
            <span>/</span>
            <span className="text-blue-600">Service History</span>
          </div>

          <Link
            href="/dashboard/bookings/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
          >
            <span>+</span>
            <span>Book a Service</span>
          </Link>
        </div>

        {/* Header Title Section */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Service History
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            View your previous services, completed work, upcoming maintenance and property service history from one place.
          </p>
        </div>

        {/* ========================================================
            4 TOP METRIC OVERVIEW CARDS
        ======================================================== */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Services */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
              🔧
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Total Services</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{bookings.length}</p>
              <p className="text-[10px] text-slate-400">All service history</p>
            </div>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Completed</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{completedBookings.length}</p>
              <p className="text-[10px] text-slate-400">Services completed</p>
            </div>
          </div>

          {/* Upcoming */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
              ⏱️
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Upcoming</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{upcomingBookings.length}</p>
              <p className="text-[10px] text-slate-400">Scheduled services</p>
            </div>
          </div>

          {/* Total Cost */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">
              👛
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Total Cost</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                ₹{totalCost.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-slate-400">Total service cost</p>
            </div>
          </div>
        </div>

        {/* ========================================================
            FILTER PILLS & SORTING ROW
        ======================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "All", label: `All Services (${bookings.length})` },
              { id: "Upcoming", label: `Upcoming (${upcomingBookings.length})` },
              { id: "Completed", label: `Completed (${completedBookings.length})` },
              { id: "InProgress", label: `In Progress (${inProgressBookings.length})` },
              { id: "Cancelled", label: `Cancelled (${cancelledBookings.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                  selectedFilter === tab.id
                    ? "bg-[#0b1a2e] text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSelectedFilter("All");
                setNavbarSearch("");
                setSortBy("newest");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
            >
              <span>🧹</span>
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            SERVICE HISTORY CARDS (NO LEFT PICTURES)
        ======================================================== */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mx-auto" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Loading service history...
            </p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
              ⏱️
            </div>
            <h2 className="text-lg font-black text-slate-900">
              No Service Records Found
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
              No services match your active filter selection.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedFilter("All");
                setNavbarSearch("");
              }}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const details = bookingDetails[booking.$id];
              const professional = getProfessionalDetails(booking.professionalId);

              return (
                <div
                  key={booking.$id}
                  className="group rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  {/* Top Bar: Title & Subtitle + Status Pill + Menu */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        {details?.serviceName || "Electrical Repair & Installation"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-600">
                          {details?.propertyName || getPropertyName(booking.propertyId)}
                        </span>{" "}
                        • Booking ID:{" "}
                        <span className="font-mono text-slate-400">{booking.$id}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {renderStatusPill(booking.status)}

                      <Link
                        href={`/dashboard/bookings/${booking.$id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition shadow-sm"
                      >
                        <span>View Details</span>
                        <span>→</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/bookings/${booking.$id}`)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        ⋮
                      </button>
                    </div>
                  </div>

                  {/* 4 Metadata Columns (No Left Picture - Full Width) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 items-center">
                    {/* Date */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-sm">
                        📅
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Date</p>
                        <p className="text-xs font-black text-slate-900 mt-0.5">
                          {formatDate(booking.bookingDate)}
                        </p>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 text-sm">
                        ⏱️
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Time</p>
                        <p className="text-xs font-black text-slate-900 mt-0.5">
                          {formatTime(booking.bookingTime)}
                        </p>
                      </div>
                    </div>

                    {/* Professional */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-sm">
                        👤
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Professional</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs font-black text-slate-900 truncate">
                            {professional?.fullName || "Assigned Professional"}
                          </p>
                          {professional?.phone && (
                            <a
                              href={`tel:${professional.phone}`}
                              className="text-xs text-blue-600 hover:text-blue-800"
                              title="Call Professional"
                            >
                              📞
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Service Cost */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-sm font-bold">
                        ₹
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Service Cost</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          ₹{Number(details?.price || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}