"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { Databases, Query as AppwriteQuery } from "appwrite";

import client from "@/lib/appwrite/client";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCustomerBookings } from "@/lib/appwrite/booking";
import { getUserProperties } from "@/lib/appwrite/property";
import { getServiceById } from "@/lib/appwrite/service";
import { getCustomerWarranties } from "@/lib/appwrite/warranty";
import { getAllMembers } from "@/lib/appwrite/member";
import { getCurrentMember } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";
import { useAuthStore } from "@/lib/stores/auth-store";

/* ============================================================
   APPWRITE CONFIG
============================================================ */
const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NOTIFICATIONS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID || "notifications";

interface Booking {
  $id: string;
  customerId: string;
  professionalId: string;
  serviceId: string;
  propertyId: string;
  bookingDate: string;
  bookingTime: string;
  status: string;
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

export default function WarrantiesAndInvoicesPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<"invoices" | "warranties">("invoices");
  const [searchFilter, setSearchFilter] = useState("");

  const storedUser = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  /* Navbar Profile */
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

  /* Live Notifications */
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

  /* Load Bookings, Properties, Warranties, & Members */
  const { data, isLoading } = useQuery({
    queryKey: ["warranties-and-invoices-data", activeUserId],
    queryFn: async () => {
      const user = await getCurrentUser();
      const [bookingRes, propRes, warrantyRes, memberRes] = await Promise.all([
        getCustomerBookings(user.$id),
        getUserProperties(user.$id),
        getCustomerWarranties(user.$id),
        getAllMembers(),
      ]);

      const allBookings = (bookingRes.documents || []) as unknown as Booking[];
      const completed = allBookings.filter((b) => b.status === "Completed");
      const properties = propRes.documents || [];
      const warranties = (warrantyRes.documents || []) as unknown as Warranty[];
      const members = memberRes.documents || [];

      const detailsMap: Record<string, any> = {};
      await Promise.all(
        completed.map(async (booking) => {
          try {
            const svc = await getServiceById(booking.serviceId);
            const prop = properties.find((p: any) => p.$id === booking.propertyId);
            const prof = members.find((m: any) => m.userId === booking.professionalId);
            detailsMap[booking.$id] = {
              serviceName: svc?.serviceName || "Completed Service",
              category: svc?.category || "Maintenance",
              price: Number(svc?.price || 1200),
              propertyName: prop?.propertyName || "My Home",
              propertyAddress: prop?.address || prop?.location || "Kestopur, Kolkata",
              professionalName: prof?.fullName || "Assigned Specialist",
              professionalPhone: prof?.phone || "+91 98765 43210",
            };
          } catch {
            detailsMap[booking.$id] = {
              serviceName: "Completed Service",
              category: "Maintenance",
              price: 1200,
              propertyName: "My Home",
              propertyAddress: "Kestopur, Kolkata",
              professionalName: "Assigned Specialist",
              professionalPhone: "+91 98765 43210",
            };
          }
        })
      );

      return {
        completedBookings: completed,
        warranties,
        detailsMap,
      };
    },
    enabled: !!activeUserId,
    staleTime: 30 * 1000,
  });

  const completedBookings = data?.completedBookings || [];
  const warranties = data?.warranties || [];
  const detailsMap = data?.detailsMap || {};

  /* Date formatting helper */
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  /* Download / Print Invoice Utility */
  const handleDownloadInvoice = (booking: Booking) => {
    const det = detailsMap[booking.$id];
    const invoiceNum = `HM-INV-${new Date(booking.bookingDate || Date.now()).getFullYear()}-${booking.$id.slice(-6).toUpperCase()}`;
    const invoiceWindow = window.open("", "_blank", "width=900,height=750");

    if (!invoiceWindow) {
      Swal.fire({
        icon: "warning",
        title: "Pop-up Blocked",
        text: "Please enable pop-ups in your browser to download or print the invoice.",
      });
      return;
    }

    invoiceWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${invoiceNum} - HomeMate Invoice</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            body { padding: 40px; color: #0f172a; background: #ffffff; }
            .invoice-box { max-width: 800px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0b1a2e; padding-bottom: 25px; }
            .logo { font-size: 26px; font-weight: 900; color: #0b1a2e; }
            .logo span { color: #2563eb; }
            .invoice-meta { text-align: right; }
            .invoice-meta h2 { font-size: 18px; font-weight: 800; color: #0f172a; }
            .invoice-meta p { font-size: 12px; color: #64748b; margin-top: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
            .info-block h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700; margin-bottom: 8px; }
            .info-block p { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin-top: 35px; }
            th { background: #f8fafc; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; }
            td { padding: 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; color: #334155; }
            .total-row td { font-weight: 800; font-size: 15px; color: #0f172a; border-top: 2px solid #0f172a; }
            .status-badge { display: inline-block; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
            @media print {
              body { padding: 0; }
              .invoice-box { border: none; box-shadow: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div>
                <div class="logo">Home<span>Mate</span></div>
                <p style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #64748b; margin-top: 4px;">HOME SERVICES & WARRANTY PLATFORM</p>
              </div>
              <div class="invoice-meta">
                <h2>TAX INVOICE</h2>
                <p><strong>Invoice ID:</strong> ${invoiceNum}</p>
                <p><strong>Booking Ref:</strong> ${booking.$id}</p>
                <p><strong>Date:</strong> ${formatDate(booking.bookingDate)}</p>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-block">
                <h4>Billed To (Customer)</h4>
                <p>${userName}</p>
                <p style="color: #64748b; font-weight: 400;">${userEmail}</p>
                <p style="color: #64748b; font-weight: 400;">Property: ${det?.propertyName || "My Home"}</p>
                <p style="color: #64748b; font-weight: 400;">${det?.propertyAddress || ""}</p>
              </div>
              <div class="info-block">
                <h4>Service Specialist</h4>
                <p>${det?.professionalName || "Assigned Specialist"}</p>
                <p style="color: #64748b; font-weight: 400;">Contact: ${det?.professionalPhone || "+91 98765 43210"}</p>
                <p style="margin-top: 8px;"><span class="status-badge">✓ PAYMENT RECEIVED</span></p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Execution Date</th>
                  <th style="text-align: right;">Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${det?.serviceName}</strong><br><span style="font-size: 11px; color: #64748b;">Comprehensive service & quality check</span></td>
                  <td>${det?.category}</td>
                  <td>${formatDate(booking.bookingDate)} (${booking.bookingTime || "01:00 PM"})</td>
                  <td style="text-align: right;">₹${(det?.price || 0).toLocaleString("en-IN")}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="3">Grand Total</td>
                  <td style="text-align: right;">₹${(det?.price || 0).toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>

            <div class="footer">
              <p>This is a computer-generated tax invoice verified under HomeMate Service Platform.</p>
              <p>Warranty claims, if applicable, are governed by provider coverage terms valid from service completion.</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    invoiceWindow.document.close();
  };

  const handleLogout = async () => {
    const res = await Swal.fire({
      title: "Logout from HomeMate?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Logout",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      reverseButtons: true,
    });
    if (!res.isConfirmed) return;
    setLoggingOut(true);
    await logoutAccount();
    clearUser();
    window.location.href = "/login";
  };

  /* Metrics calculations */
  const totalCoveredValue = useMemo(() => {
    return completedBookings.reduce((sum, b) => sum + Number(detailsMap[b.$id]?.price || 0), 0);
  }, [completedBookings, detailsMap]);

  const activeWarrantiesCount = useMemo(() => {
    return warranties.filter((w) => w.status === "Active").length;
  }, [warranties]);

  const filteredInvoices = useMemo(() => {
    if (!searchFilter.trim()) return completedBookings;
    const term = searchFilter.toLowerCase();
    return completedBookings.filter((b) => {
      const det = detailsMap[b.$id];
      return (
        b.$id.toLowerCase().includes(term) ||
        det?.serviceName?.toLowerCase().includes(term) ||
        det?.propertyName?.toLowerCase().includes(term)
      );
    });
  }, [completedBookings, searchFilter, detailsMap]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

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
          <Link href="/dashboard" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">🏠</span>
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/properties" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">🏘️</span>
            <span>My Properties</span>
          </Link>
          <Link href="/dashboard/maintenance" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">🔧</span>
            <span>Maintenance</span>
          </Link>
          <Link href="/dashboard/bookings/new" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">🛠️</span>
            <span>Book a Service</span>
          </Link>
          <Link href="/dashboard/bookings" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">📅</span>
            <span>My Bookings</span>
          </Link>
          <Link href="/dashboard/service-history" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">⏱️</span>
            <span>Service History</span>
          </Link>
          <Link href="/dashboard/warranties" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/30">
            <span className="text-base">🧾</span>
            <span>Invoices & Warranty</span>
          </Link>
          <Link href="/dashboard/marketplace" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">🛒</span>
            <span>Marketplace</span>
          </Link>
          <Link href="/dashboard/notifications" className="flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
            <span className="text-base">🔔</span>
            <span>Notifications</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-2 text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 text-xs font-bold"
          >
            <span className="text-base">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur lg:ml-64">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"
          >
            ☰
          </button>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black uppercase text-blue-600">
            INVOICES & WARRANTY
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Link
              href="/dashboard/notifications"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              🔔
            </Link>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white">
                {unreadNotificationsCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="h-10 w-10 rounded-full border bg-blue-50 overflow-hidden flex items-center justify-center font-bold text-blue-600 text-xs">
              {userProfileImage ? (
                <img src={userProfileImage} alt={userName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-400">{userEmail}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
        {/* Breadcrumb & New Service Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <Link href="/dashboard" className="hover:text-slate-700">Home</Link>
            <span>/</span>
            <span className="text-blue-600">Invoices & Warranty</span>
          </div>

          <Link
            href="/dashboard/bookings/new"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            + Book a Service
          </Link>
        </div>

        {/* Hero Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Invoices & Warranty Coverage
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Download verified tax invoices and review warranty protections for completed home services.
          </p>
        </div>

        {/* 4 Top KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">
              🧾
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Total Invoices</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{completedBookings.length}</p>
              <p className="text-[10px] text-slate-400">Completed bookings</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">
              🛡️
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Active Warranties</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{activeWarrantiesCount}</p>
              <p className="text-[10px] text-slate-400">Protected services</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
              ⌛
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Total Records</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{warranties.length}</p>
              <p className="text-[10px] text-slate-400">Recorded coverage</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">
              ₹
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Covered Value</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">₹{totalCoveredValue.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-slate-400">Total invoiced amount</p>
            </div>
          </div>
        </div>

        {/* Tab Selector & Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold transition ${
                activeTab === "invoices"
                  ? "bg-[#0b1a2e] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Tax Invoices ({completedBookings.length})
            </button>
            <button
              onClick={() => setActiveTab("warranties")}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold transition ${
                activeTab === "warranties"
                  ? "bg-[#0b1a2e] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Warranty Information ({warranties.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by invoice or service..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* TAB 1: INVOICES (WITH PDF/PRINT DOWNLOAD) */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="rounded-3xl border bg-white p-16 text-center shadow-sm">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mx-auto" />
                <p className="mt-3 text-xs text-slate-400">Loading invoice records...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
                <span className="text-4xl">🧾</span>
                <h3 className="text-base font-bold text-slate-900 mt-3">No Invoices Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Invoices are automatically generated once a home-service request is completed.
                </p>
              </div>
            ) : (
              filteredInvoices.map((booking) => {
                const det = detailsMap[booking.$id];
                const invoiceCode = `HM-INV-${new Date(booking.bookingDate || Date.now()).getFullYear()}-${booking.$id.slice(-6).toUpperCase()}`;

                return (
                  <div
                    key={booking.$id}
                    className="group rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 font-bold text-xl">
                          🧾
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            TAX INVOICE
                          </span>
                          <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                            {det?.serviceName || "Service"}
                          </h3>
                          <p className="text-xs font-mono text-slate-400">
                            Invoice: <span className="font-bold text-slate-600">{invoiceCode}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-200">
                          ✓ Paid & Completed
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(booking)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
                        >
                          <span>📥</span>
                          <span>Download Invoice</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Property</p>
                        <p className="font-black text-slate-900 mt-0.5">{det?.propertyName || "My Home"}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{det?.propertyAddress}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Service Date</p>
                        <p className="font-black text-slate-900 mt-0.5">{formatDate(booking.bookingDate)}</p>
                        <p className="text-[10px] text-slate-400">{booking.bookingTime || "01:00 PM"}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Professional</p>
                        <p className="font-black text-slate-900 mt-0.5 truncate">{det?.professionalName}</p>
                        <p className="text-[10px] text-slate-400">{det?.professionalPhone}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Amount Paid</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">₹{(det?.price || 0).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: WARRANTIES */}
        {activeTab === "warranties" && (
          <div className="space-y-4">
            {warranties.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm">
                <span className="text-4xl">🛡️</span>
                <h3 className="text-base font-bold text-slate-900 mt-3">No Active Warranties</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  When a verified professional records warranty terms and protection periods for your completed service, they appear here.
                </p>
              </div>
            ) : (
              warranties.map((w) => (
                <div
                  key={w.$id}
                  className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-blue-300 transition"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-lg">
                        🛡️
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{w.warrantyTerms || "Service Protection Guarantee"}</h4>
                        <p className="text-xs text-slate-400 font-mono">Ref: {w.bookingId || w.$id}</p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold border ${
                        w.status === "Active"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : w.status === "Expired"
                          ? "bg-rose-50 text-rose-600 border-rose-200"
                          : "bg-blue-50 text-blue-600 border-blue-200"
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Coverage Period</p>
                      <p className="font-bold text-slate-900 mt-0.5">{w.warrantyPeriod || "6 Months"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Effective Date</p>
                      <p className="font-bold text-slate-900 mt-0.5">{formatDate(w.warrantyStartDate) || "Upon Completion"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Expiration Date</p>
                      <p className="font-bold text-slate-900 mt-0.5">{formatDate(w.warrantyExpiryDate) || "Not Specified"}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}