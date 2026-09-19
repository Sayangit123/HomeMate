"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Databases, ID, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import {
  getCustomerBookings,
  cancelBooking,
} from "@/lib/appwrite/booking";
import {
  getUserProperties,
} from "@/lib/appwrite/property";
import {
  getServiceById,
} from "@/lib/appwrite/service";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";

// Zustand Stores
import { useBookingStore } from "@/lib/stores/booking-store";
import { useAuthStore } from "@/lib/stores/auth-store";

/* ============================================================
   APPWRITE CONFIG
============================================================ */

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COMPLAINTS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_COMPLAINTS_TABLE_ID || "complaints";
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

/* ============================================================
   TYPES
============================================================ */

interface Property {
  $id: string;
  propertyName?: string;
  address?: string;
  location?: string | null;
}

interface Service {
  $id: string;
  userId: string;
  serviceName: string;
  description?: string;
  duration: number;
  price: number;
  category?: string;
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

interface BookingDetails {
  serviceName: string;
  price: number;
  duration: number;
  propertyName: string;
  propertyLocation: string;
  category: string;
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function MyBookingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [navbarSearch, setNavbarSearch] = useState("");

  // Zustand stores
  const { statusFilter, setStatusFilter } = useBookingStore();
  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

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
     TANSTACK QUERY: FETCH USER, BOOKINGS & DETAILS
  ========================================================== */
  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer", "my-bookings"],
    queryFn: async () => {
      const user = await getCurrentUser();

      const [bookingResponse, propertyResponse] = await Promise.all([
        getCustomerBookings(user.$id),
        getUserProperties(user.$id),
      ]);

      const customerBookings =
        (bookingResponse.documents || []) as unknown as Booking[];
      const customerProperties =
        (propertyResponse.documents || []) as unknown as Property[];

      try {
        await fetch("/api/notifications/reminders", { method: "GET" });
      } catch (reminderErr) {
        console.warn("Reminder check skipped:", reminderErr);
      }

      const detailsMap: Record<string, BookingDetails> = {};
      await Promise.all(
        customerBookings.map(async (booking) => {
          let serviceName = "Home Service";
          let price = 1000;
          let duration = 60;
          let category = "General";

          try {
            const service = (await getServiceById(booking.serviceId)) as unknown as Service;
            if (service) {
              serviceName = service.serviceName;
              price = service.price ?? 1000;
              duration = service.duration ?? 60;
              category = service.category || "General";
            }
          } catch {
            // fallback defaults
          }

          const property = customerProperties.find(
            (item) => item.$id === booking.propertyId
          );

          detailsMap[booking.$id] = {
            serviceName,
            price,
            duration,
            propertyName: property?.propertyName || "My Home",
            propertyLocation: property?.location || property?.address || "Kestopur, Kolkata",
            category,
          };
        })
      );

      return {
        user,
        bookings: customerBookings,
        bookingDetails: detailsMap,
      };
    },
    staleTime: 30 * 1000,
  });

  const bookings = data?.bookings || [];
  const bookingDetails = data?.bookingDetails || {};

  /* ==========================================================
     TANSTACK MUTATION: CANCEL BOOKING
  ========================================================== */
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      setCancellingId(bookingId);
      return await cancelBooking(bookingId);
    },
    onSuccess: async () => {
      await Swal.fire({
        icon: "success",
        title: "Booking Cancelled",
        text: "Your booking has been cancelled successfully.",
        confirmButtonColor: "#2563eb",
      });
      queryClient.invalidateQueries({ queryKey: ["customer", "my-bookings"] });
    },
    onError: (error: any) => {
      console.error("Cancel error:", error);
      Swal.fire({
        icon: "error",
        title: "Cancellation Failed",
        text: error?.message || "Unable to cancel this booking.",
      });
    },
    onSettled: () => {
      setCancellingId(null);
    },
  });

  /* ==========================================================
     TANSTACK MUTATION: LODGE COMPLAINT
  ========================================================== */
  const lodgeComplaintMutation = useMutation({
    mutationFn: async ({
      booking,
      formValues,
    }: {
      booking: Booking;
      formValues: { type: string; subject: string; description: string };
    }) => {
      return await databases.createDocument(
        DATABASE_ID,
        COMPLAINTS_TABLE_ID,
        ID.unique(),
        {
          bookingId: booking.$id,
          customerId: booking.customerId,
          professionalId: booking.professionalId || null,
          complaintType: formValues.type,
          subject: formValues.subject,
          description: formValues.description,
          status: "Pending",
        }
      );
    },
    onSuccess: async () => {
      await Swal.fire({
        icon: "success",
        title: "Complaint Lodged",
        text: "Your complaint has been submitted to the Admin team for review.",
        confirmButtonColor: "#2563eb",
      });
      queryClient.invalidateQueries({ queryKey: ["customer", "my-bookings"] });
    },
    onError: (error: any) => {
      console.error("Complaint submission error:", error);
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text:
          error?.message ||
          "Could not submit complaint. Please check your database permissions.",
      });
    },
  });

  const handleOpenComplaintModal = async (booking: Booking) => {
    const details = bookingDetails[booking.$id];

    const { value: formValues } = await Swal.fire({
      title: "Lodge a Complaint",
      html: `
        <div style="text-align: left; font-size: 13px; display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label style="font-weight: 600; font-size: 11px; color: #475569; text-transform: uppercase;">Service</label>
            <input value="${details?.serviceName || "Service"} (ID: ${booking.$id.slice(0, 8)}...)" disabled style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; font-size: 12px; color: #64748b; margin-top: 4px;" />
          </div>

          <div>
            <label style="font-weight: 600; font-size: 11px; color: #475569; text-transform: uppercase;">Complaint Type</label>
            <select id="swal-type" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; margin-top: 4px;">
              <option value="Service Quality">Service Quality</option>
              <option value="Professional Conduct">Professional Conduct</option>
              <option value="Delay / No-Show">Delay / No-Show</option>
              <option value="Payment Dispute">Payment Dispute</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; font-size: 11px; color: #475569; text-transform: uppercase;">Subject</label>
            <input id="swal-subject" placeholder="e.g. Technician arrived late / unfinished service" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; margin-top: 4px;" />
          </div>

          <div>
            <label style="font-weight: 600; font-size: 11px; color: #475569; text-transform: uppercase;">Description</label>
            <textarea id="swal-desc" rows="3" placeholder="Explain the issue in detail..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; margin-top: 4px; resize: none;"></textarea>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Submit Complaint",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      preConfirm: () => {
        const type = (document.getElementById("swal-type") as HTMLSelectElement).value;
        const subject = (document.getElementById("swal-subject") as HTMLInputElement).value?.trim();
        const description = (document.getElementById("swal-desc") as HTMLTextAreaElement).value?.trim();

        if (!subject || !description) {
          Swal.showValidationMessage("Please provide both a subject and a description");
          return null;
        }
        return { type, subject, description };
      },
    });

    if (!formValues) return;
    lodgeComplaintMutation.mutate({ booking, formValues });
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

  const formatDate = (dateValue: string) => {
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

  /* ==========================================================
     COUNTS & FILTERING
  ========================================================== */
  const counts = useMemo(() => {
    return {
      all: bookings.length,
      requested: bookings.filter((b) => b.status === "Requested").length,
      accepted: bookings.filter((b) => b.status === "Accepted").length,
      inProgress: bookings.filter((b) => b.status === "InProgress").length,
      completed: bookings.filter((b) => b.status === "Completed").length,
      cancelled: bookings.filter((b) => b.status === "Cancelled").length,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (statusFilter && statusFilter !== "All") {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (navbarSearch.trim()) {
      const term = navbarSearch.toLowerCase();
      list = list.filter((b) => {
        const det = bookingDetails[b.$id];
        return (
          b.$id.toLowerCase().includes(term) ||
          det?.serviceName?.toLowerCase().includes(term) ||
          det?.propertyName?.toLowerCase().includes(term) ||
          det?.propertyLocation?.toLowerCase().includes(term)
        );
      });
    }

    return [...list].sort((a, b) => {
      const dateA = new Date(`${a.bookingDate} ${a.bookingTime || ""}`).getTime();
      const dateB = new Date(`${b.bookingDate} ${b.bookingTime || ""}`).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [bookings, statusFilter, navbarSearch, sortBy, bookingDetails]);

  /* ==========================================================
     LOADING / ERROR STATES
  ========================================================== */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f7fb] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Loading your bookings...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[#f4f7fb] flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-lg">
          <p className="text-xl font-bold text-rose-600">Failed to Load Bookings</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["customer", "my-bookings"] })}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      </div>
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30"
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

      {/* Top Navbar with Searchbar */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur lg:ml-64 gap-4">
        {/* Left: Mobile Toggle & Global Search Bar */}
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

          {/* Search bar inside navbar */}
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              value={navbarSearch}
              onChange={(e) => setNavbarSearch(e.target.value)}
              placeholder="Search services, properties, or anything..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm"
            />
          </div>
        </div>

        {/* Right: Notifications & User Profile */}
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
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </button>

        {/* ========================================================
            HERO PROMOTIONAL BANNER
        ======================================================== */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-100 via-sky-50 to-blue-50 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                BOOKINGS
              </span>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 mt-1">
                My Bookings
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
                Track your service bookings and current status.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden xl:flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 border border-white/80 shadow-sm backdrop-blur">
                <span className="text-2xl">✨</span>
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-700 uppercase">Your Comfort</p>
                  <p className="text-[9px] font-semibold text-slate-400">Our Priority</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/dashboard/bookings/new")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
              >
                <span>+</span>
                <span>Book a Service</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            FILTER PILLS & SORTING ROW
        ======================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Filter Chips with Counts */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "All", label: `All (${counts.all})`, icon: "🗂️" },
              { id: "Requested", label: `Requested (${counts.requested})`, icon: "⏱️" },
              { id: "Accepted", label: `Accepted (${counts.accepted})`, icon: "✓" },
              { id: "InProgress", label: `In Progress (${counts.inProgress})`, icon: "⚙️" },
              { id: "Completed", label: `Completed (${counts.completed})`, icon: "✓" },
              { id: "Cancelled", label: `Cancelled (${counts.cancelled})`, icon: "✕" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  statusFilter === tab.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-bold">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* ========================================================
            BOOKING CARDS
        ======================================================== */}
        {filteredBookings.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
              📅
            </div>
            <h2 className="text-lg font-black text-slate-900">
              No Bookings Found
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
              {statusFilter === "All"
                ? "You haven't booked any professional services yet. Book your first service today."
                : `No bookings matching "${statusFilter}".`}
            </p>
            {statusFilter === "All" ? (
              <button
                type="button"
                onClick={() => router.push("/dashboard/bookings/new")}
                className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
              >
                + Book Your First Service
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStatusFilter("All")}
                className="mt-4 text-xs font-bold text-blue-600 hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {filteredBookings.map((booking) => {
              const details = bookingDetails[booking.$id];

              return (
                <div
                  key={booking.$id}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  {/* Top Bar: Title & ID + Status Pill + Menu */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        BOOKING
                      </span>
                      <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                        {details?.serviceName || "Service"}
                      </h2>
                      <p className="text-[11px] font-mono text-slate-400">
                        Booking ID: {booking.$id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                          booking.status === "InProgress"
                            ? "bg-purple-50 text-purple-600 border border-purple-200"
                            : booking.status === "Completed"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : booking.status === "Accepted"
                            ? "bg-blue-50 text-blue-600 border border-blue-200"
                            : booking.status === "Cancelled"
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : "bg-amber-50 text-amber-600 border border-amber-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            booking.status === "InProgress"
                              ? "bg-purple-600 animate-pulse"
                              : booking.status === "Completed"
                              ? "bg-emerald-600"
                              : "bg-current"
                          }`}
                        />
                        <span>{booking.status === "InProgress" ? "In Progress" : booking.status}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenComplaintModal(booking)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Options / Lodge Complaint"
                      >
                        ⋮
                      </button>
                    </div>
                  </div>

                  {/* Specifications Deck */}
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3.5 items-center bg-slate-50/40 p-4 rounded-2xl border border-slate-100">
                    {/* Property */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-sm">
                        🏠
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Property</p>
                        <p className="text-xs font-black text-slate-900 leading-tight">
                          {details?.propertyName || "My Home"}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {details?.propertyLocation || "Kestopur, Kolkata"}
                        </p>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-sm">
                        📅
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Date</p>
                        <p className="text-xs font-black text-slate-900">
                          {formatDate(booking.bookingDate)}
                        </p>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 text-sm">
                        ⏱️
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Time</p>
                        <p className="text-xs font-black text-slate-900">
                          {booking.bookingTime || "01:00 PM"}
                        </p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-sm font-bold">
                        ₹
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Price</p>
                        <p className="text-xs font-black text-slate-900">
                          ₹{details?.price ?? 1000}
                        </p>
                      </div>
                    </div>

                    {/* Service Duration */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 text-sm">
                        ⌛
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Service Duration</p>
                        <p className="text-xs font-black text-slate-900">
                          {details?.duration ? `${details.duration} minutes` : "60 minutes"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes Bar & Actions */}
                  <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2 flex-1 border border-slate-100">
                      <span className="text-xs">📝</span>
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-700">Notes:</span>{" "}
                        {booking.notes || "No additional notes provided."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* View Details */}
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/bookings/${booking.$id}`)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                      >
                        View Details
                      </button>

                      {/* Action Button: Reschedule / Book Again / Cancel */}
                      {booking.status === "Completed" ? (
                        <button
                          type="button"
                          onClick={() => router.push("/dashboard/bookings/new")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-sm"
                        >
                          <span>🔄</span>
                          <span>Book Again</span>
                        </button>
                      ) : booking.status === "Requested" ? (
                        <button
                          type="button"
                          onClick={() => {
                            Swal.fire({
                              icon: "warning",
                              title: "Cancel Booking?",
                              text: "Are you sure you want to cancel this booking?",
                              showCancelButton: true,
                              confirmButtonText: "Yes, Cancel",
                              cancelButtonText: "Keep Booking",
                              confirmButtonColor: "#dc2626",
                            }).then((res) => {
                              if (res.isConfirmed) {
                                cancelBookingMutation.mutate(booking.$id);
                              }
                            });
                          }}
                          disabled={cancellingId === booking.$id}
                          className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition disabled:opacity-50"
                        >
                          {cancellingId === booking.$id ? "Cancelling..." : "Cancel"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/bookings/${booking.$id}/reschedule`)}
                          className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
                        >
                          Reschedule
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================
            BOTTOM ACTION BANNER
        ======================================================== */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600 shadow-sm">
              📅
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Need a new service?
              </h3>
              <p className="text-xs text-slate-500">
                Book trusted professionals for cleaning, repairs, installation and more.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard/bookings/new")}
            className="shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition"
          >
            + Book a Service
          </button>
        </div>
      </main>
    </div>
  );
}