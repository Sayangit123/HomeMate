"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query } from "appwrite";
import Swal from "sweetalert2";

import client from "@/lib/appwrite/client";

import {
  getAllMembers,
} from "@/lib/appwrite/member";

import {
  getAllServices,
} from "@/lib/appwrite/service";

import {
  getCurrentUser,
  logoutAccount,
} from "@/lib/appwrite/account";

import {
  getCurrentMember,
  type MemberRow,
} from "@/lib/appwrite/database";

import {
  getProfileImageUrl,
} from "@/lib/appwrite/storage";

/* ============================================================
   APPWRITE CONFIG
============================================================ */

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const BOOKINGS_TABLE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_BOOKINGS_TABLE_ID || "bookings";

/* ============================================================
   TYPES
============================================================ */

interface AppwriteUser {
  $id: string;
  name: string;
  email: string;
  $createdAt: string;
}

interface Member {
  $id: string;
  userId: string;
  fullName?: string | null;
  phone?: string | null;
  role: "customer" | "professional" | "business" | "admin";
  profileImage?: string | null;
  profileCompletion?: number | null;
  verificationStatus?: string | null;
  licenseDocument?: string | null;
  certificateDocument?: string | null;
  verificationSubmittedAt?: string | null;
  $createdAt?: string;
  $updatedAt?: string;
}

interface Service {
  $id: string;
  userId: string;
  serviceName?: string | null;
  description?: string | null;
  price?: number | null;
  duration?: number | null;
  availableDays?: string | string[];
  availableSlots?: string | string[];
  $createdAt?: string;
}

interface Booking {
  $id: string;
  customerId?: string | null;
  professionalId?: string | null;
  serviceId?: string | null;
  propertyId?: string | null;
  bookingDate?: string | null;
  bookingTime?: string | null;
  status:
    | "Requested"
    | "Accepted"
    | "InProgress"
    | "Completed"
    | "Cancelled"
    | string;
  $createdAt?: string;
}

interface DashboardData {
  members: Member[];
  services: Service[];
  bookings: Booking[];
}

/* ============================================================
   UI MINI COMPONENTS (CHARTS & SPARKLES)
============================================================ */

function MiniSparkline({ color = "#2563eb" }: { color?: string }) {
  return (
    <svg className="h-7 w-20 overflow-visible" viewBox="0 0 80 28" fill="none">
      <path
        d="M2 20 Q 20 8, 32 18 T 58 10 T 78 4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ModernDonutChart({
  customers,
  professionals,
  businesses,
  admins,
}: {
  customers: number;
  professionals: number;
  businesses: number;
  admins: number;
}) {
  const total = customers + professionals + businesses + admins || 1;

  const pctCustomers = Math.round((customers / total) * 100);
  const pctProfessionals = Math.round((professionals / total) * 100);
  const pctBusinesses = Math.round((businesses / total) * 100);
  const pctAdmins = Math.max(0, 100 - pctCustomers - pctProfessionals - pctBusinesses);

  const deg1 = (pctCustomers / 100) * 360;
  const deg2 = deg1 + (pctProfessionals / 100) * 360;
  const deg3 = deg2 + (pctBusinesses / 100) * 360;

  return (
    <div className="flex flex-col items-center justify-between gap-6 py-2 sm:flex-row">
      <div className="relative flex h-48 w-48 shrink-0 items-center justify-center">
        <div
          className="h-full w-full rounded-full transition-all duration-700"
          style={{
            background: `conic-gradient(#2563eb 0deg ${deg1}deg, #8b5cf6 ${deg1}deg ${deg2}deg, #f97316 ${deg2}deg ${deg3}deg, #10b981 ${deg3}deg 360deg)`,
            boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.25)",
          }}
        />
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-2xl font-black tracking-tight text-slate-800">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] font-medium text-slate-400">Users</span>
        </div>
      </div>

      <div className="w-full max-w-[240px] space-y-3.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Customers
          </span>
          <span className="font-bold text-slate-900">
            {pctCustomers}%{" "}
            <span className="font-normal text-slate-400">({customers})</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Professionals
          </span>
          <span className="font-bold text-slate-900">
            {pctProfessionals}%{" "}
            <span className="font-normal text-slate-400">({professionals})</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Businesses
          </span>
          <span className="font-bold text-slate-900">
            {pctBusinesses}%{" "}
            <span className="font-normal text-slate-400">({businesses})</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Admins
          </span>
          <span className="font-bold text-slate-900">
            {pctAdmins}%{" "}
            <span className="font-normal text-slate-400">({admins})</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   REAL DATABASE-DRIVEN BOOKING OVERVIEW BAR CHART
============================================================ */
function BookingOverviewChart({
  bookings,
}: {
  bookings: Booking[];
}) {
  const [hoveredMonth, setHoveredMonth] = useState<{
    m: string;
    req: number;
    comp: number;
    can: number;
    x: number;
  } | null>(null);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();

  // Aggregate live Appwrite booking data by month & status
  const monthlyData = useMemo(() => {
    const map = monthLabels.map((m) => ({
      m,
      req: 0,
      comp: 0,
      can: 0,
    }));

    bookings.forEach((b) => {
      const rawDate = b.bookingDate || b.$createdAt;
      if (!rawDate) return;

      const date = new Date(rawDate);
      if (isNaN(date.getTime())) return;

      if (date.getFullYear() === currentYear) {
        const monthIdx = date.getMonth();
        if (monthIdx >= 0 && monthIdx < 12) {
          const status = (b.status || "").toLowerCase();
          if (status === "requested") {
            map[monthIdx].req += 1;
          } else if (status === "completed") {
            map[monthIdx].comp += 1;
          } else if (status === "cancelled") {
            map[monthIdx].can += 1;
          }
        }
      }
    });

    const currentMonthIdx = new Date().getMonth();
    const visibleCount = Math.max(currentMonthIdx + 1, 9);
    return map.slice(0, visibleCount);
  }, [bookings, currentYear]);

  const totalRequested = useMemo(
    () => bookings.filter((b) => (b.status || "").toLowerCase() === "requested").length,
    [bookings]
  );
  const totalCompleted = useMemo(
    () => bookings.filter((b) => (b.status || "").toLowerCase() === "completed").length,
    [bookings]
  );
  const totalCancelled = useMemo(
    () => bookings.filter((b) => (b.status || "").toLowerCase() === "cancelled").length,
    [bookings]
  );

  // Maximum scale value for Y axis
  const maxVal = useMemo(() => {
    let top = 4;
    monthlyData.forEach((d) => {
      if (d.req > top) top = d.req;
      if (d.comp > top) top = d.comp;
      if (d.can > top) top = d.can;
    });
    return top + 1;
  }, [monthlyData]);

  const chartWidth = 560;
  const chartHeight = 180;
  const paddingTop = 20;
  const paddingBottom = 28;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const stepX = chartWidth / monthlyData.length;
  const barW = Math.min(10, stepX * 0.22);
  const baselineY = chartHeight - paddingBottom;

  return (
    <div className="w-full flex flex-col justify-between pt-1">
      {/* Header Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1877F2]" />
            <span>Requested ({totalRequested})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
            <span>Completed ({totalCompleted})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F43F5E]" />
            <span>Cancelled ({totalCancelled})</span>
          </div>
        </div>

        <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
          {currentYear} ▾
        </span>
      </div>

      {/* SVG Clustered Bar Chart */}
      <div className="relative mt-3 w-full">
        {hoveredMonth && (
          <div
            style={{ left: `${(hoveredMonth.x / chartWidth) * 100}%` }}
            className="absolute -top-11 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white shadow-xl animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap"
          >
            <span className="text-blue-400 font-extrabold">{hoveredMonth.m} Bookings</span>
            <span className="text-slate-300 text-[10px] font-medium">
              Requested: {hoveredMonth.req} • Done: {hoveredMonth.comp} • Cancelled: {hoveredMonth.can}
            </span>
          </div>
        )}

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-56 overflow-visible"
        >
          {/* Gridlines */}
          {[0, 0.33, 0.66, 1].map((ratio, i) => {
            const y = paddingTop + usableHeight * (1 - ratio);
            return (
              <g key={i}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={0}
                  y={y - 4}
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {Math.round(maxVal * ratio)}
                </text>
              </g>
            );
          })}

          {/* Render Live Bars */}
          {monthlyData.map((item, idx) => {
            const groupCenterX = idx * stepX + stepX / 2;

            const reqH = item.req > 0 ? Math.max(6, (item.req / maxVal) * usableHeight) : 0;
            const compH = item.comp > 0 ? Math.max(6, (item.comp / maxVal) * usableHeight) : 0;
            const canH = item.can > 0 ? Math.max(6, (item.can / maxVal) * usableHeight) : 0;

            const reqX = groupCenterX - barW * 1.5;
            const compX = groupCenterX - barW * 0.5;
            const canX = groupCenterX + barW * 0.5;

            const isHovered = hoveredMonth?.m === item.m;

            return (
              <g
                key={item.m}
                className="cursor-pointer"
                opacity={hoveredMonth && !isHovered ? 0.45 : 1}
                onMouseEnter={() =>
                  setHoveredMonth({
                    m: item.m,
                    req: item.req,
                    comp: item.comp,
                    can: item.can,
                    x: groupCenterX,
                  })
                }
                onMouseLeave={() => setHoveredMonth(null)}
              >
                {/* Full column hit area */}
                <rect
                  x={groupCenterX - stepX / 2}
                  y={paddingTop}
                  width={stepX}
                  height={usableHeight}
                  fill="transparent"
                />

                {/* Requested Bar */}
                {reqH > 0 ? (
                  <rect
                    x={reqX}
                    y={baselineY - reqH}
                    width={barW}
                    height={reqH}
                    rx={2.5}
                    fill="#1877F2"
                  />
                ) : (
                  <circle cx={reqX + barW / 2} cy={baselineY} r={1.5} fill="#cbd5e1" />
                )}

                {/* Completed Bar */}
                {compH > 0 ? (
                  <rect
                    x={compX}
                    y={baselineY - compH}
                    width={barW}
                    height={compH}
                    rx={2.5}
                    fill="#10B981"
                  />
                ) : (
                  <circle cx={compX + barW / 2} cy={baselineY} r={1.5} fill="#cbd5e1" />
                )}

                {/* Cancelled Bar */}
                {canH > 0 ? (
                  <rect
                    x={canX}
                    y={baselineY - canH}
                    width={barW}
                    height={canH}
                    rx={2.5}
                    fill="#F43F5E"
                  />
                ) : (
                  <circle cx={canX + barW / 2} cy={baselineY} r={1.5} fill="#cbd5e1" />
                )}

                {/* Month label */}
                <text
                  x={groupCenterX}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  fill={isHovered ? "#1877F2" : "#64748b"}
                  fontSize="11"
                  fontWeight="bold"
                >
                  {item.m}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ============================================================
   PROFILE AVATAR
============================================================ */

function ProfileAvatar({
  profileImage,
  name,
  size = "normal",
}: {
  profileImage?: string | null;
  name?: string | null;
  size?: "small" | "normal" | "large";
}) {
  const [imageError, setImageError] = useState(false);
  const displayName = name?.trim() || "HomeMate User";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "U";

  const resolvedImageUrl = useMemo(() => {
    if (!profileImage || imageError) return "";
    if (profileImage.startsWith("http://") || profileImage.startsWith("https://")) {
      return profileImage;
    }
    try {
      return getProfileImageUrl(profileImage).toString();
    } catch {
      return "";
    }
  }, [profileImage, imageError]);

  const sizeClass =
    size === "large"
      ? "h-14 w-14 text-base"
      : size === "small"
        ? "h-8 w-8 text-[11px]"
        : "h-10 w-10 text-xs";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-slate-200 bg-blue-50 ${sizeClass}`}
    >
      {resolvedImageUrl ? (
        <img
          src={resolvedImageUrl}
          alt={displayName}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-black text-blue-600 bg-blue-100/60">
          {initials}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MAIN DASHBOARD COMPONENT
============================================================ */

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<AppwriteUser | null>(null);
  const [currentMember, setCurrentMember] = useState<MemberRow | null>(null);
  const [adminProfileImage, setAdminProfileImage] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  // Mobile sidebar drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Notification menu toggle and read state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ==========================================================
     DASHBOARD QUERY
  ========================================================== */
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const [membersResponse, servicesResponse, bookingsResponse] =
        await Promise.all([
          getAllMembers(),
          getAllServices(),
          databases.listDocuments(DATABASE_ID, BOOKINGS_TABLE_ID, [
            Query.orderDesc("$createdAt"),
          ]),
        ]);

      return {
        members: (membersResponse.documents || []) as unknown as Member[],
        services: (servicesResponse.documents || []) as unknown as Service[],
        bookings: (bookingsResponse.documents || []) as unknown as Booking[],
      };
    },
    retry: 1,
    staleTime: 30 * 1000,
  });

  const members = dashboardQuery.data?.members || [];
  const services = dashboardQuery.data?.services || [];
  const bookings = dashboardQuery.data?.bookings || [];

  /* ==========================================================
     LOAD CURRENT ADMIN
  ========================================================== */
  useEffect(() => {
    let mounted = true;
    const loadCurrentAdmin = async () => {
      try {
        const user = await getCurrentUser();
        if (!mounted) return;
        setCurrentUser(user as AppwriteUser);

        let member = await getCurrentMember(user.$id);

        if (!member && members.length > 0) {
          member = members.find(
            (m) => m.userId === user.$id || m.$id === user.$id
          ) as any;
        }

        if (member) {
          if (!mounted) return;
          setCurrentMember(member);

          if (member.profileImage) {
            try {
              const imageUrl = getProfileImageUrl(member.profileImage);
              setAdminProfileImage(imageUrl.toString());
            } catch {
              setAdminProfileImage(member.profileImage);
            }
          }
        }
      } catch (error) {
        console.error("Unable to load admin:", error);
      } finally {
        if (mounted) setAdminLoading(false);
      }
    };

    loadCurrentAdmin();
    return () => {
      mounted = false;
    };
  }, [members]);

  const adminName =
    currentMember?.fullName?.trim() ||
    currentUser?.name?.trim() ||
    "Sunnit Singh";

  const normalMembers = useMemo(
    () => members.filter((m) => m.role !== "admin"),
    [members]
  );
  const customerCount = useMemo(
    () => normalMembers.filter((m) => m.role === "customer").length,
    [normalMembers]
  );
  const professionalCount = useMemo(
    () => normalMembers.filter((m) => m.role === "professional").length,
    [normalMembers]
  );
  const businessCount = useMemo(
    () => normalMembers.filter((m) => m.role === "business").length,
    [normalMembers]
  );
  const adminCount = useMemo(
    () => members.filter((m) => m.role === "admin").length,
    [members]
  );

  const pendingVerification = useMemo(
    () =>
      normalMembers.filter(
        (m) =>
          m.role === "professional" &&
          (m.verificationStatus || "Pending").toLowerCase() === "pending"
      ),
    [normalMembers]
  );

  const requestedBookings = useMemo(
    () => bookings.filter((b) => b.status === "Requested").length,
    [bookings]
  );
  const acceptedBookings = useMemo(
    () => bookings.filter((b) => b.status === "Accepted").length,
    [bookings]
  );
  const inProgressBookings = useMemo(
    () => bookings.filter((b) => b.status === "InProgress").length,
    [bookings]
  );
  const activeBookings = acceptedBookings + inProgressBookings;

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === "Completed").length,
    [bookings]
  );
  const cancelledBookings = useMemo(
    () => bookings.filter((b) => b.status === "Cancelled").length,
    [bookings]
  );

  const recentUsers = useMemo(
    () =>
      [...normalMembers]
        .sort(
          (a, b) =>
            new Date(b.$createdAt || 0).getTime() -
            new Date(a.$createdAt || 0).getTime()
        )
        .slice(0, 5),
    [normalMembers]
  );

  const recentBookings = useMemo(
    () =>
      [...bookings]
        .sort(
          (a, b) =>
            new Date(b.$createdAt || 0).getTime() -
            new Date(a.$createdAt || 0).getTime()
        )
        .slice(0, 5),
    [bookings]
  );

  const getServiceName = (serviceId?: string | null) => {
    if (!serviceId) return "Home Cleaning";
    const service = services.find((item) => item.$id === serviceId);
    return service?.serviceName || "Home Service";
  };
// Live notifications count (counts active notification items in the dropdown)
const unreadCount = useMemo(() => {
  if (notificationsRead) return 0;
  let count = 0;
  if (pendingVerification.length > 0) count += 1;
  if (requestedBookings > 0) count += 1;
  count += 1; // Complaints queue item
  return count;
}, [pendingVerification.length, requestedBookings, notificationsRead]);

  /* ==========================================================
     LOGOUT HANDLER
  ========================================================== */
  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Logout from HomeMate?",
      text: "Your current administrator session will be ended.",
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
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.error("Server logout error:", err);
      }
      try {
        await logoutAccount();
      } catch (err) {
        console.error("Appwrite logout error:", err);
      }

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
        text: "You have been successfully logged out.",
        timer: 1200,
        showConfirmButton: false,
      });

      window.location.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      window.location.replace("/login");
    }
  };

  if (dashboardQuery.isLoading || adminLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm font-semibold text-slate-500">
            Loading HomeMate Dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-xl font-bold text-rose-500">
            !
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-800">
            Dashboard Unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Could not load platform metrics right now.
          </p>
          <button
            onClick={() => dashboardQuery.refetch()}
            className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">
      {/* ==========================================================
          MOBILE / TABLET SIDEBAR DRAWER & BACKDROP
      ========================================================== */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/80 bg-white transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Home<span className="text-blue-600">Mate</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4 text-sm font-semibold">
          <Link
            href="/dashboard/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/25"
          >
            <span className="text-lg">🏠</span>
            <span>Dashboard</span>
          </Link>
          <Link
            href="/dashboard/admin/users"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">👥</span>
            <span>User Management</span>
          </Link>
          <Link
            href="/dashboard/admin/professionals"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">🧰</span>
            <span>Professionals</span>
          </Link>
          <Link
            href="/dashboard/admin/businesses"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">🏢</span>
            <span>Businesses</span>
          </Link>
          <Link
            href="/dashboard/admin/services"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">🔧</span>
            <span>Services</span>
          </Link>
          <Link
            href="/dashboard/admin/bookings"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">📅</span>
            <span>Bookings</span>
          </Link>
          <Link
            href="/dashboard/admin/payments"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">💳</span>
            <span>Payments</span>
          </Link>
          <Link
            href="/dashboard/admin/complaints"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">📢</span>
            <span>Complaints</span>
          </Link>
          <Link
            href="/dashboard/admin/analytics"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">📊</span>
            <span>Analytics</span>
          </Link>
          <Link
            href="/dashboard/admin/settings"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">⚙️</span>
            <span>Platform Settings</span>
          </Link>
        </nav>

        {/* Mobile Logout Button */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
          >
            <span>🚪</span>
            <span>Logout Account</span>
          </button>
        </div>
      </aside>

      {/* ==========================================================
          DESKTOP SIDEBAR
      ========================================================== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
        {/* Brand */}
        <div className="flex h-20 items-center gap-3 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-slate-900">
              Home<span className="text-blue-600">Mate</span>
            </span>
            <p className="text-[9px] font-semibold text-slate-400">
              Services for a Better Home
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4 text-sm font-semibold">
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/25"
          >
            <span className="text-lg">🏠</span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/dashboard/admin/users"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">👥</span>
            <span>User Management</span>
          </Link>

          <Link
            href="/dashboard/admin/professionals"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">🧰</span>
            <span>Professionals</span>
          </Link>

          <Link
            href="/dashboard/admin/businesses"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">🏢</span>
            <span>Businesses</span>
          </Link>

          <Link
            href="/dashboard/admin/services"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">🔧</span>
            <span>Services</span>
          </Link>

          <Link
            href="/dashboard/admin/bookings"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">📅</span>
            <span>Bookings</span>
          </Link>
          <Link
            href="/dashboard/admin/payments"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">💳</span>
            <span>Payments</span>
          </Link>

          <Link
            href="/dashboard/admin/complaints"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">📢</span>
            <span>Complaints</span>
          </Link>

          <Link
            href="/dashboard/admin/analytics"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">📊</span>
            <span>Analytics</span>
          </Link>

          <Link
            href="/dashboard/admin/professionals"
            className="flex items-center justify-between rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <div className="flex items-center gap-3.5">
              <span className="text-lg">🛡️</span>
              <span>Verification (KYC)</span>
            </div>
            {pendingVerification.length > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {pendingVerification.length}
              </span>
            )}
          </Link>

          <Link
            href="/dashboard/admin/settings"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="text-lg">⚙️</span>
            <span>Platform Settings</span>
          </Link>
        </nav>

        {/* Sidebar Promo Box */}
        <div className="p-4 space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/70 p-4 border border-blue-100">
            <h4 className="text-xs font-black text-slate-900 leading-tight">
              Build a<br />Better Home<br />Together
            </h4>
            <p className="mt-1 text-[10px] font-medium text-slate-500">
              Safe • Reliable • Trusted
            </p>
            <div className="mt-3 flex justify-center">
              <span className="text-4xl">🏡</span>
            </div>
          </div>

          {/* Desktop Sidebar Bottom Logout */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
          >
            <span>🚪</span>
            <span>Logout Account</span>
          </button>
        </div>
      </aside>

      {/* ==========================================================
          HEADER
      ========================================================== */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur lg:ml-64">
        {/* Left: Mobile Sidebar Toggler & Portal Tag */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open Navigation Menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-blue-600">
            Admin Management Console
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Active Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label="Notifications"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              🔔
            </button>

            {unreadCount > 0 && (
              <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm">
                {unreadCount}
              </span>
            )}

            {/* Notification Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-black text-slate-900">
                    Notifications
                  </h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => setNotificationsRead(true)}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
                  {pendingVerification.length > 0 && (
                    <Link
                      href="/dashboard/admin/professionals"
                      onClick={() => setShowNotifications(false)}
                      className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-amber-50/60"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs">
                        🛡️
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">
                          {pendingVerification.length} Pending KYC Requests
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Professionals awaiting document verification
                        </p>
                      </div>
                    </Link>
                  )}

                  {requestedBookings > 0 && (
                    <Link
                      href="/dashboard/admin/bookings"
                      onClick={() => setShowNotifications(false)}
                      className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-blue-50/60"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs">
                        📅
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">
                          {requestedBookings} New Booking Requests
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Customers placed new service requests
                        </p>
                      </div>
                    </Link>
                  )}

                  <Link
                    href="/dashboard/admin/complaints"
                    onClick={() => setShowNotifications(false)}
                    className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-rose-50/60"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-xs">
                      📢
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800">
                        Customer Complaints Queue
                      </p>
                      <p className="text-[10px] text-slate-400">
                        5 open complaints need administrator review
                      </p>
                    </div>
                  </Link>

                  {unreadCount === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">
                      No new notifications
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin Profile Area */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <ProfileAvatar
              profileImage={adminProfileImage || currentMember?.profileImage}
              name={adminName}
              size="normal"
            />
            <div className="hidden text-left sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {adminName}
              </p>
              <p className="text-[10px] font-medium text-slate-400">
                Super Admin
              </p>
            </div>
          </div>

          {/* Top Navbar Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            title="Logout from HomeMate"
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-600 hover:text-white active:scale-95"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ==========================================================
          MAIN BODY
      ========================================================== */}
      <main className="p-4 sm:p-6 lg:ml-64 space-y-6">
        {/* WELCOME BANNER */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-100/40 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                WELCOME BACK,
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {adminName} <span className="animate-bounce text-2xl">👋</span>
              </h1>
              <p className="mt-1.5 text-xs text-slate-500">
                Here&apos;s what&apos;s happening with your HomeMate platform today.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="hidden border-l border-blue-200/60 pl-6 md:block">
                <p className="text-xs font-semibold italic text-slate-600">
                  “A clean home makes a happy life.”
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                  — HomeMate
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
                <span className="text-2xl">☀️</span>
                <div>
                  <p className="text-[10px] font-bold text-slate-400">
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-sm font-black text-slate-800">
                    Good Afternoon!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5 ACTIVE CLICKABLE METRIC CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/dashboard/admin/users"
            className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                👥
              </div>
              <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600">
                Total Users
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {normalMembers.length.toLocaleString()}
                </p>
                <p className="mt-1 flex items-center text-[10px] font-bold text-emerald-500">
                  ↑ +12%
                </p>
              </div>
              <MiniSparkline color="#2563eb" />
            </div>
          </Link>

          <Link
            href="/dashboard/admin/professionals"
            className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition group-hover:bg-purple-600 group-hover:text-white">
                🧰
              </div>
              <span className="text-xs font-bold text-slate-500 group-hover:text-purple-600">
                Professionals
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {professionalCount.toLocaleString()}
                </p>
                <p className="mt-1 flex items-center text-[10px] font-bold text-emerald-500">
                  ↑ +8%
                </p>
              </div>
              <MiniSparkline color="#8b5cf6" />
            </div>
          </Link>

          <Link
            href="/dashboard/admin/businesses"
            className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-300 hover:shadow-md active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-600 group-hover:text-white">
                🏢
              </div>
              <span className="text-xs font-bold text-slate-500 group-hover:text-amber-600">
                Businesses
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {businessCount.toLocaleString()}
                </p>
                <p className="mt-1 flex items-center text-[10px] font-bold text-emerald-500">
                  ↑ +15%
                </p>
              </div>
              <MiniSparkline color="#f59e0b" />
            </div>
          </Link>

          <Link
            href="/dashboard/admin/services"
            className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-md active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 transition group-hover:bg-cyan-600 group-hover:text-white">
                🔧
              </div>
              <span className="text-xs font-bold text-slate-500 group-hover:text-cyan-600">
                Services
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {services.length.toLocaleString()}
                </p>
                <p className="mt-1 flex items-center text-[10px] font-bold text-emerald-500">
                  ↑ +10%
                </p>
              </div>
              <MiniSparkline color="#06b6d4" />
            </div>
          </Link>

          <Link
            href="/dashboard/admin/bookings"
            className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-rose-300 hover:shadow-md active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white">
                📅
              </div>
              <span className="text-xs font-bold text-slate-500 group-hover:text-rose-600">
                Total Bookings
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">
                  {bookings.length.toLocaleString()}
                </p>
                <p className="mt-1 flex items-center text-[10px] font-bold text-emerald-500">
                  ↑ +18%
                </p>
              </div>
              <MiniSparkline color="#f43f5e" />
            </div>
          </Link>
        </div>

        {/* 2 MIDDLE CHARTS */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Donut User Distribution */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-5">
            <h3 className="text-sm font-black text-slate-900">
              User Distribution
            </h3>
            <div className="mt-4">
              <ModernDonutChart
                customers={customerCount}
                professionals={professionalCount}
                businesses={businessCount}
                admins={adminCount}
              />
            </div>
          </div>

          {/* Database-Driven Clustered Bar Chart Booking Overview */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-7 flex flex-col justify-between">
            <h3 className="text-sm font-black text-slate-900">
              Booking Overview
            </h3>
            <div className="mt-2 flex-1">
              <BookingOverviewChart bookings={bookings} />
            </div>
          </div>
        </div>

        {/* 4 STATUS / KYC ACTION CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-bold text-slate-500">
                Pending Verifications
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {pendingVerification.length}
              </p>
              <p className="text-[10px] font-medium text-slate-400">
                Professional KYC
              </p>
              <Link
                href="/dashboard/admin/professionals"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                Review →
              </Link>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl text-white shadow-lg shadow-blue-500/30">
              🛡️
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/40 p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-bold text-slate-500">
                Open Complaints
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900">5</p>
              <p className="text-[10px] font-medium text-slate-400">
                Need Attention
              </p>
              <Link
                href="/dashboard/admin/complaints"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                View →
              </Link>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-red-500 text-2xl text-white shadow-lg shadow-rose-500/30">
              📣
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-bold text-slate-500">
                Active Bookings
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {activeBookings}
              </p>
              <p className="text-[10px] font-medium text-slate-400">
                In Progress
              </p>
              <Link
                href="/dashboard/admin/bookings"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                View →
              </Link>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-2xl text-white shadow-lg shadow-teal-500/30">
              🗓️
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-bold text-slate-500">
                Revenue (Est.)
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900">₹ 4.8L</p>
              <p className="text-[10px] font-medium text-slate-400">
                This Month
              </p>
              <Link
                href="/dashboard/admin/analytics"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                View →
              </Link>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl text-white shadow-lg shadow-amber-500/30">
              📈
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: RECENT USERS, RECENT BOOKINGS & QUICK ACTIONS */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Recent Registrations */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-sm font-black text-slate-900">
                Recent Registrations
              </h3>
              <Link
                href="/dashboard/admin/users"
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                View All →
              </Link>
            </div>

            <div className="mt-4 space-y-4">
              {recentUsers.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No recent users
                </p>
              ) : (
                recentUsers.map((user) => (
                  <div
                    key={user.$id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProfileAvatar
                        profileImage={user.profileImage}
                        name={user.fullName}
                        size="small"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {user.fullName || "User"}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">
                          {user.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="hidden text-[10px] text-slate-400 sm:inline">
                        {user.userId ? `${user.userId.slice(0, 6)}@mail.com` : "user@mail.com"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold capitalize ${
                          user.role === "professional"
                            ? (user.verificationStatus || "Pending").toLowerCase() === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {user.role === "professional"
                          ? user.verificationStatus || "Pending"
                          : "Active"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-sm font-black text-slate-900">
                Recent Bookings
              </h3>
              <Link
                href="/dashboard/admin/bookings"
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                View All →
              </Link>
            </div>

            <div className="mt-4 space-y-4">
              {recentBookings.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No bookings yet
                </p>
              ) : (
                recentBookings.map((b) => (
                  <div
                    key={b.$id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs text-blue-600">
                        📄
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">
                          BK-{b.$id.slice(0, 4).toUpperCase()}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">
                          {getServiceName(b.serviceId)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                        b.status === "Requested"
                          ? "bg-blue-100 text-blue-600"
                          : b.status === "InProgress"
                            ? "bg-purple-100 text-purple-600"
                            : b.status === "Completed"
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-rose-100 text-rose-600"
                      }`}
                    >
                      {b.status === "InProgress" ? "In Progress" : b.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-3">
            <h3 className="border-b border-slate-100 pb-4 text-sm font-black text-slate-900">
              Quick Actions
            </h3>
            <div className="mt-4 space-y-3">
              <Link
                href="/dashboard/admin/users"
                className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100/70"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-sm">
                  +
                </span>
                <span>Add New Admin</span>
              </Link>

              <Link
                href="/dashboard/admin/services"
                className="flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100/70"
              >
                <span className="text-sm">🔧</span>
                <span>Manage Services</span>
              </Link>

              <Link
                href="/dashboard/admin/professionals"
                className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100/70"
              >
                <span className="text-sm">🛡️</span>
                <span>Review Professionals</span>
              </Link>

              <Link
                href="/dashboard/admin/settings"
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <span className="text-sm">⚙️</span>
                <span>Platform Settings</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ==========================================================
            FOOTER
        ========================================================== */}
        <footer className="mt-12 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                  🏠
                </div>
                <div>
                  <span className="text-lg font-black tracking-tight text-slate-900">
                    Home<span className="text-blue-600">Mate</span>
                  </span>
                  <p className="text-[9px] font-semibold text-slate-400">
                    Services for a Better Home
                  </p>
                </div>
              </div>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-400">
                Connecting trusted professionals with home-owners and commercial
                spaces across the country.
              </p>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Admin
              </h5>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>
                  <Link href="/dashboard/admin" className="hover:text-blue-600">
                    Dashboard
                  </Link>
                </p>
                <p>
                  <Link
                    href="/dashboard/admin/users"
                    className="hover:text-blue-600"
                  >
                    Users
                  </Link>
                </p>
                <p>
                  <Link
                    href="/dashboard/admin/services"
                    className="hover:text-blue-600"
                  >
                    Services
                  </Link>
                </p>
                <p>
                  <Link
                    href="/dashboard/admin/bookings"
                    className="hover:text-blue-600"
                  >
                    Bookings
                  </Link>
                </p>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Support
              </h5>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p className="hover:text-blue-600 cursor-pointer">Help Center</p>
                <p className="hover:text-blue-600 cursor-pointer">Contact Support</p>
                <p className="hover:text-blue-600 cursor-pointer">System Status</p>
                <p className="hover:text-blue-600 cursor-pointer">Report an Issue</p>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Follow Us
              </h5>
              <div className="mt-3 flex gap-3 text-lg text-slate-500">
                <span className="cursor-pointer hover:text-blue-600">🌐</span>
                <span className="cursor-pointer hover:text-blue-600">📷</span>
                <span className="cursor-pointer hover:text-blue-600">💼</span>
                <span className="cursor-pointer hover:text-blue-600">▶️</span>
              </div>
              <p className="mt-4 text-[10px] text-slate-400">
                © {new Date().getFullYear()} HomeMate. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}