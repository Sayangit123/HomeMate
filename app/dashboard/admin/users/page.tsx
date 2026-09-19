"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Databases, Query, ID } from "appwrite";
import Swal from "sweetalert2";

import client from "@/lib/appwrite/client";
import { getAllMembers } from "@/lib/appwrite/member";
import { getCurrentUser, logoutAccount } from "@/lib/appwrite/account";
import { getCurrentMember, type MemberRow } from "@/lib/appwrite/database";
import { getProfileImageUrl } from "@/lib/appwrite/storage";

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const MEMBERS_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID || "members";

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
  $createdAt?: string;
  $updatedAt?: string;
}

export default function AdminUsersPage() {
  const [currentUser, setCurrentUser] = useState<AppwriteUser | null>(null);
  const [currentMember, setCurrentMember] = useState<MemberRow | null>(null);
  const [adminProfileImage, setAdminProfileImage] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  // Modals state
  const [selectedUser, setSelectedUser] = useState<Member | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    role: "customer" as Member["role"],
    verificationStatus: "Approved",
  });
  const [saving, setSaving] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  /* Fetch Members */
  const { data: members = [], isLoading: membersLoading, refetch } = useQuery({
    queryKey: ["admin", "users-directory"],
    queryFn: async (): Promise<Member[]> => {
      const res = await getAllMembers();
      return (res.documents || []) as unknown as Member[];
    },
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    let mounted = true;
    const loadAdmin = async () => {
      try {
        const user = await getCurrentUser();
        if (!mounted) return;
        setCurrentUser(user as AppwriteUser);

        const member = await getCurrentMember(user.$id);
        if (member && mounted) {
          setCurrentMember(member);
          if (member.profileImage) {
            try {
              setAdminProfileImage(getProfileImageUrl(member.profileImage).toString());
            } catch {
              setAdminProfileImage(member.profileImage);
            }
          }
        }
      } catch (error) {
        console.error("Admin load error:", error);
      } finally {
        if (mounted) setAdminLoading(false);
      }
    };
    loadAdmin();
    return () => {
      mounted = false;
    };
  }, []);

  const adminName = currentMember?.fullName?.trim() || currentUser?.name?.trim() || "Sunnit Singh";

  // Filter out admin accounts from the directory list
  const nonAdminMembers = useMemo(() => {
    return members.filter((m) => m.role !== "admin");
  }, [members]);

  const customerCount = useMemo(() => nonAdminMembers.filter((m) => m.role === "customer").length, [nonAdminMembers]);
  const professionalCount = useMemo(() => nonAdminMembers.filter((m) => m.role === "professional").length, [nonAdminMembers]);
  const businessCount = useMemo(() => nonAdminMembers.filter((m) => m.role === "business").length, [nonAdminMembers]);

  const filteredUsers = useMemo(() => {
    return nonAdminMembers.filter((m) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (m.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.phone || "").includes(searchQuery) ||
        m.$id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === "All" || m.role.toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [nonAdminMembers, searchQuery, roleFilter]);

  /* CRUD Handlers */
  const handleOpenCreate = () => {
    setFormData({ fullName: "", phone: "", role: "customer", verificationStatus: "Approved" });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (user: Member) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName || "",
      phone: user.phone || "",
      role: user.role || "customer",
      verificationStatus: user.verificationStatus || "Approved",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      Swal.fire("Error", "Full Name is required.", "error");
      return;
    }

    try {
      setSaving(true);
      await databases.createDocument(DATABASE_ID, MEMBERS_TABLE_ID, ID.unique(), {
        userId: ID.unique(),
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        verificationStatus: formData.verificationStatus,
        profileCompletion: 100,
      });

      setIsCreateModalOpen(false);
      await refetch();
      Swal.fire({
        icon: "success",
        title: "User Created",
        text: "New user profile has been successfully created.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error("Create user error:", err);
      Swal.fire("Error", err?.message || "Could not create user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSaving(true);
      await databases.updateDocument(DATABASE_ID, MEMBERS_TABLE_ID, selectedUser.$id, {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        verificationStatus: formData.verificationStatus,
      });

      setIsEditModalOpen(false);
      await refetch();
      Swal.fire({
        icon: "success",
        title: "User Updated",
        text: "User details have been updated successfully.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error("Edit user error:", err);
      Swal.fire("Error", err?.message || "Could not update user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: Member) => {
    const res = await Swal.fire({
      title: "Delete User?",
      text: `Are you sure you want to delete "${user.fullName || "this user"}"? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });

    if (!res.isConfirmed) return;

    try {
      await databases.deleteDocument(DATABASE_ID, MEMBERS_TABLE_ID, user.$id);
      await refetch();
      Swal.fire({
        icon: "success",
        title: "User Deleted",
        text: "The user has been deleted from the platform.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error("Delete user error:", err);
      Swal.fire("Error", err?.message || "Could not delete user.", "error");
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Logout from HomeMate?",
      text: "Your current administrator session will be ended.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Logout",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      await logoutAccount();
      window.location.replace("/login");
    } catch {
      window.location.replace("/login");
    }
  };

  if (membersLoading || adminLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm font-semibold text-slate-500">Loading User Management...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 antialiased">
      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/80 bg-white transition-transform duration-300 ease-in-out lg:hidden ${mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <span className="text-lg font-black tracking-tight text-slate-900">Home<span className="text-blue-600">Mate</span></span>
          <button onClick={() => setMobileMenuOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500">✕</button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4 text-sm font-semibold">
          <Link href="/dashboard/admin" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500">🏠 Dashboard</Link>
          <Link href="/dashboard/admin/users" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md">👥 User Management</Link>
          <Link href="/dashboard/admin/professionals" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500">🧰 Professionals</Link>
          <Link href="/dashboard/admin/businesses" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500">🏢 Businesses</Link>
        </nav>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 px-6 border-b border-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">🏠</div>
          <span className="text-xl font-black tracking-tight text-slate-900">Home<span className="text-blue-600">Mate</span></span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5 text-sm font-semibold">
          <Link href="/dashboard/admin" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50">🏠 Dashboard</Link>
          <Link href="/dashboard/admin/users" className="flex items-center gap-3.5 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-md shadow-blue-600/25">👥 User Management</Link>
          <Link href="/dashboard/admin/professionals" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50">🧰 Professionals</Link>
          <Link href="/dashboard/admin/businesses" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50">🏢 Businesses</Link>
          <Link href="/dashboard/admin/services" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50">🔧 Services</Link>
          <Link href="/dashboard/admin/bookings" className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50">📅 Bookings</Link>
        </nav>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur lg:ml-64">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 lg:hidden">☰</button>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-blue-600">User Management Portal</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="h-10 w-10 overflow-hidden rounded-full border bg-blue-50">
              {adminProfileImage ? (
                <img src={adminProfileImage} alt={adminName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-blue-600">A</div>
              )}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-bold text-slate-900">{adminName}</p>
              <p className="text-[10px] text-slate-400">Super Admin</p>
            </div>
          </div>
          <button onClick={handleLogout} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition">Logout</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 sm:p-6 lg:ml-64 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">User Accounts Directory</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">Create, view, edit, and delete customer, professional, and business platform profiles.</p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-95"
          >
            <span>+</span>
            <span>Create New User</span>
          </button>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-xl font-bold">👥</div>
            <div>
              <p className="text-xs font-bold text-slate-400">Total Users</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{nonAdminMembers.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-bold">🏡</div>
            <div>
              <p className="text-xs font-bold text-slate-400">Homeowners</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{customerCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-xl font-bold">🧰</div>
            <div>
              <p className="text-xs font-bold text-slate-400">Professionals</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{professionalCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">🏢</div>
            <div>
              <p className="text-xs font-bold text-slate-400">Businesses</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{businessCount}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="relative sm:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone or user ID..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none"
            >
              <option value="All">All Roles</option>
              <option value="customer">Customer</option>
              <option value="professional">Professional</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>

        {/* User Directory Table */}
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">Member Directory</h3>
            <span className="text-xs text-slate-400 font-medium">Showing {filteredUsers.length} of {nonAdminMembers.length} users</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-sm font-bold text-slate-400">No users found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-4 pl-6">User</th>
                    <th className="p-4">User ID</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Verification</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredUsers.map((user) => (
                    <tr key={user.$id} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 pl-6 flex items-center gap-3">
                        <ProfileAvatar profileImage={user.profileImage} name={user.fullName} size="small" />
                        <div>
                          <p className="font-bold text-slate-900">{user.fullName || "Unnamed User"}</p>
                          <p className="text-[10px] text-slate-400">{user.userId ? `${user.userId.slice(0, 8)}@homemate.app` : "user@homemate.app"}</p>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-slate-500">{user.$id}</td>
                      <td className="p-4">{user.phone || "—"}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600 border border-blue-200 capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          (user.verificationStatus || "Approved").toLowerCase() === "pending"
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        }`}>
                          {user.verificationStatus || "Approved"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">
                        {user.$createdAt ? new Date(user.$createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "12 Sep 2026"}
                      </td>
                      <td className="p-4 pr-6 text-right space-x-2">
                        <button
                          onClick={() => { setSelectedUser(user); setIsViewModalOpen(true); }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ==========================================================
         VIEW USER MODAL
      ========================================================== */}
      {isViewModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">User Profile Details</h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="flex items-center gap-4 py-2">
              <ProfileAvatar profileImage={selectedUser.profileImage} name={selectedUser.fullName} size="large" />
              <div>
                <h4 className="text-lg font-black text-slate-900">{selectedUser.fullName || "User"}</h4>
                <p className="text-xs text-blue-600 capitalize font-bold">{selectedUser.role} Account</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p><strong className="text-slate-400 uppercase text-[10px] block">User ID</strong> <span className="font-mono text-slate-800">{selectedUser.$id}</span></p>
              <p><strong className="text-slate-400 uppercase text-[10px] block">Phone Number</strong> {selectedUser.phone || "Not provided"}</p>
              <p><strong className="text-slate-400 uppercase text-[10px] block">Verification Status</strong> {selectedUser.verificationStatus || "Approved"}</p>
              <p><strong className="text-slate-400 uppercase text-[10px] block">Profile Completion</strong> {selectedUser.profileCompletion ?? 100}%</p>
            </div>

            <button
              onClick={() => setIsViewModalOpen(false)}
              className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition shadow-md"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================
         CREATE / EDIT USER MODAL
      ========================================================== */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {isCreateModalOpen ? "Create New User Profile" : "Edit User Details"}
              </h3>
              <button
                onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={isCreateModalOpen ? handleSaveCreate : handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter full name..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Member["role"] })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="customer">Customer</option>
                  <option value="professional">Professional</option>
                  <option value="business">Business</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Verification Status</label>
                <select
                  value={formData.verificationStatus}
                  onChange={(e) => setFormData({ ...formData, verificationStatus: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : isCreateModalOpen ? "Create User" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileAvatar({ profileImage, name, size = "normal" }: { profileImage?: string | null; name?: string | null; size?: "small" | "normal" | "large" }) {
  const [imageError, setImageError] = useState(false);
  const displayName = name?.trim() || "User";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0)).join("").toUpperCase() || "U";

  const resolvedImageUrl = useMemo(() => {
    if (!profileImage || imageError) return "";
    if (profileImage.startsWith("http")) return profileImage;
    try {
      return getProfileImageUrl(profileImage).toString();
    } catch {
      return "";
    }
  }, [profileImage, imageError]);

  const sizeClass = size === "large" ? "h-14 w-14 text-base" : size === "small" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full border border-slate-200 bg-blue-50 ${sizeClass}`}>
      {resolvedImageUrl ? (
        <img src={resolvedImageUrl} alt={displayName} className="h-full w-full object-cover" onError={() => setImageError(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-bold text-blue-600 bg-blue-100">{initials}</div>
      )}
    </div>
  );
}