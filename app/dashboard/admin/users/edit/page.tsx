"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import {
    Databases,
} from "appwrite";

import client from "@/lib/appwrite/client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MEMBERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";

interface Member {
    $id: string;
    userId: string;
    fullName: string;
    phone?: string | null;
    role:
        | "customer"
        | "professional"
        | "business"
        | "admin";
    profileImage?: string | null;
    profileCompletion: number;
    verificationStatus:
        | "Pending"
        | "Approved"
        | "Rejected";
    licenseDocument?: string | null;
    certificateDocument?: string | null;
    verificationSubmittedAt?: string | null;
    $createdAt?: string;
}

function EditUserPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const memberId =
        searchParams.get("id");

    const [member, setMember] =
        useState<Member | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [fullName, setFullName] =
        useState("");

    const [phone, setPhone] =
        useState("");

    const [role, setRole] =
        useState<
            "customer" |
            "professional" |
            "business"
        >("customer");

    const [profileCompletion, setProfileCompletion] =
        useState("0");

    const [verificationStatus, setVerificationStatus] =
        useState<
            "Pending" |
            "Approved" |
            "Rejected"
        >("Pending");

    /* ============================================================
       LOAD USER
    ============================================================ */

    const loadUser = async () => {
        if (!memberId) {
            await Swal.fire({
                icon: "error",
                title: "User Not Selected",
                text: "No user was selected for editing.",
                confirmButtonColor: "#0f172a",
            });

            router.push(
                "/dashboard/admin/users"
            );

            return;
        }

        try {
            setLoading(true);

            const response =
                await databases.getDocument(
                    DATABASE_ID,
                    MEMBERS_TABLE_ID,
                    memberId
                );

            const user =
                response as unknown as Member;

            setMember(user);

            setFullName(
                user.fullName || ""
            );

            setPhone(
                user.phone || ""
            );

            /*
             * Admin should not be assigned
             * from this edit form.
             */
            if (
                user.role === "customer" ||
                user.role === "professional" ||
                user.role === "business"
            ) {
                setRole(user.role);
            }

            setProfileCompletion(
                String(
                    user.profileCompletion ?? 0
                )
            );

            if (
                user.verificationStatus ===
                    "Approved" ||
                user.verificationStatus ===
                    "Rejected" ||
                user.verificationStatus ===
                    "Pending"
            ) {
                setVerificationStatus(
                    user.verificationStatus
                );
            }
        } catch (error) {
            console.error(
                "Unable to load user:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Unable to Load User",
                text: "Something went wrong while loading this user's information.",
                confirmButtonColor: "#0f172a",
            });

            router.push(
                "/dashboard/admin/users"
            );
        } finally {
            setLoading(false);
        }
    };

    /* ============================================================
       INITIAL LOAD
    ============================================================ */

    useEffect(() => {
        loadUser();
    }, [memberId]);

    /* ============================================================
       SAVE USER
    ============================================================ */

    const handleSave = async () => {
        if (!member) {
            return;
        }

        const trimmedName =
            fullName.trim();

        const trimmedPhone =
            phone.trim();

        if (!trimmedName) {
            await Swal.fire({
                icon: "warning",
                title: "Full Name Required",
                text: "Please enter the user's full name.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        const completion =
            Number(profileCompletion);

        if (
            Number.isNaN(completion) ||
            completion < 0 ||
            completion > 100
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Invalid Profile Completion",
                text: "Profile completion must be between 0 and 100.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        try {
            setSaving(true);

            await databases.updateDocument(
                DATABASE_ID,
                MEMBERS_TABLE_ID,
                member.$id,
                {
                    fullName: trimmedName,
                    phone:
                        trimmedPhone || null,
                    role,
                    profileCompletion:
                        completion,
                    verificationStatus,
                }
            );

            await Swal.fire({
                icon: "success",
                title: "User Updated",
                text: "The user's information has been updated successfully.",
                confirmButtonColor: "#0f172a",
                timer: 1600,
                timerProgressBar: true,
            });

            router.push(
                "/dashboard/admin/users"
            );
        } catch (error) {
            console.error(
                "Unable to update user:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Update Failed",
                text: "Something went wrong while updating the user.",
                confirmButtonColor: "#0f172a",
            });
        } finally {
            setSaving(false);
        }
    };

    /* ============================================================
       LOADING
    ============================================================ */

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50">

                <div className="text-center">

                    <div className="mx-auto h-10 w-10 animate-spin border-2 border-slate-200 border-t-slate-950" />

                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                        Loading User
                    </p>

                </div>

            </main>
        );
    }

    /* ============================================================
       USER NOT FOUND
    ============================================================ */

    if (!member) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">

                <div className="border border-slate-200 bg-white p-8 text-center">

                    <h1 className="text-xl font-bold text-slate-950">
                        User Not Found
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        The selected user could not be found.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/admin/users"
                            )
                        }
                        className="mt-6 border border-slate-200 bg-slate-950 px-5 py-3 text-xs font-bold text-white"
                    >
                        Back to Users
                    </button>

                </div>

            </main>
        );
    }

    /* ============================================================
       EDIT PAGE
    ============================================================ */

    return (
        <main className="min-h-screen bg-slate-50 text-slate-950">

            {/* ========================================================
                NAVBAR
            ======================================================== */}

            <header className="border-b border-slate-200 bg-white">

                <div className="mx-auto flex min-h-[82px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/admin/users"
                            )
                        }
                        className="flex items-center gap-3 text-left"
                    >

                        <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                            H
                        </div>

                        <div>

                            <h1 className="text-xl font-bold tracking-tight">
                                HomeMate
                            </h1>

                            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                Super Admin Portal
                            </p>

                        </div>

                    </button>

                    <div className="flex items-center gap-3">

                        <div className="hidden text-right sm:block">

                            <p className="text-xs font-bold text-slate-900">
                                Super Admin
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                                Edit User
                            </p>

                        </div>

                        <div className="flex h-10 w-10 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                            A
                        </div>

                    </div>

                </div>

            </header>

            {/* ========================================================
                CONTENT
            ======================================================== */}

            <div className="mx-auto max-w-[1000px] px-5 py-8 sm:px-8 lg:px-10">

                {/* PAGE HEADER */}

                <section className="mb-8">

                    <div className="mb-4 flex items-center gap-3">

                        <span className="h-px w-10 bg-[#caa66a]" />

                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                            Administration / Users / Edit
                        </span>

                    </div>

                    <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                        Edit User
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Update the selected user's HomeMate
                        account information.
                    </p>

                </section>

                {/* ====================================================
                    USER IDENTIFICATION
                ==================================================== */}

                <section className="mb-5 border border-slate-200 bg-white">

                    <div className="border-b border-slate-100 px-6 py-5">

                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Selected User
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-slate-950">
                            {member.fullName}
                        </h3>

                    </div>

                    <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">

                        <div>

                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Member ID
                            </p>

                            <p className="mt-2 break-all font-mono text-xs text-slate-600">
                                {member.$id}
                            </p>

                        </div>

                        <div>

                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                User ID
                            </p>

                            <p className="mt-2 break-all font-mono text-xs text-slate-600">
                                {member.userId}
                            </p>

                        </div>

                    </div>

                </section>

                {/* ====================================================
                    EDIT FORM
                ==================================================== */}

                <section className="border border-slate-200 bg-white">

                    <div className="border-b border-slate-100 px-6 py-5">

                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Account Information
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-slate-950">
                            User Details
                        </h3>

                    </div>

                    <div className="grid gap-6 px-6 py-7">

                        {/* FULL NAME */}

                        <div>

                            <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Full Name
                            </label>

                            <input
                                type="text"
                                value={fullName}
                                onChange={(event) =>
                                    setFullName(
                                        event.target.value
                                    )
                                }
                                placeholder="Enter full name"
                                className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:bg-white"
                            />

                        </div>

                        {/* PHONE */}

                        <div>

                            <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Phone Number
                            </label>

                            <input
                                type="text"
                                value={phone}
                                onChange={(event) =>
                                    setPhone(
                                        event.target.value
                                    )
                                }
                                placeholder="Enter phone number"
                                className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:bg-white"
                            />

                        </div>

                        {/* ROLE */}

                        <div>

                            <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Role
                            </label>

                            <select
                                value={role}
                                onChange={(event) =>
                                    setRole(
                                        event.target
                                            .value as typeof role
                                    )
                                }
                                className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-950"
                            >

                                <option value="customer">
                                    Customer
                                </option>

                                <option value="professional">
                                    Professional
                                </option>

                                <option value="business">
                                    Business
                                </option>

                            </select>

                            <p className="mt-2 text-[10px] text-slate-400">
                                Admin role is protected and cannot be assigned from this form.
                            </p>

                        </div>

                        {/* PROFILE COMPLETION */}

                        <div>

                            <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Profile Completion (%)
                            </label>

                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={
                                    profileCompletion
                                }
                                onChange={(event) =>
                                    setProfileCompletion(
                                        event.target.value
                                    )
                                }
                                className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-950 focus:bg-white"
                            />

                            <div className="mt-3 h-1.5 w-full bg-slate-100">

                                <div
                                    className="h-full bg-slate-950 transition-all"
                                    style={{
                                        width: `${Math.min(
                                            Math.max(
                                                Number(
                                                    profileCompletion
                                                ) || 0,
                                                0
                                            ),
                                            100
                                        )}%`,
                                    }}
                                />

                            </div>

                        </div>

                        {/* VERIFICATION STATUS */}

                        <div>

                            <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Verification Status
                            </label>

                            <select
                                value={
                                    verificationStatus
                                }
                                onChange={(event) =>
                                    setVerificationStatus(
                                        event.target
                                            .value as typeof verificationStatus
                                    )
                                }
                                className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-950"
                            >

                                <option value="Pending">
                                    Pending
                                </option>

                                <option value="Approved">
                                    Approved
                                </option>

                                <option value="Rejected">
                                    Rejected
                                </option>

                            </select>

                        </div>

                    </div>

                    {/* ==================================================
                        ACTIONS
                    ================================================== */}

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end">

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/admin/users"
                                )
                            }
                            disabled={saving}
                            className="border border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-slate-950 px-6 py-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving
                                ? "Saving..."
                                : "Save Changes"}
                        </button>

                    </div>

                </section>

                {/* BACK */}

                <div className="mt-6">

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/admin/users"
                            )
                        }
                        className="text-xs font-bold text-slate-500 transition hover:text-slate-950"
                    >
                        ← Back to User Management
                    </button>

                </div>

                {/* FOOTER */}

                <footer className="mt-10 border-t border-slate-200 py-6">

                    <div className="flex flex-col justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:flex-row">

                        <p>
                            HomeMate • Home Services & Community Platform
                        </p>

                        <p>
                            Super Admin • Edit User
                        </p>

                    </div>

                </footer>

            </div>

        </main>
    );
}

export default function EditUserPage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen items-center justify-center bg-slate-50">
                    <div className="text-center">
                        <div className="mx-auto h-10 w-10 animate-spin border-2 border-slate-200 border-t-slate-950" />
                        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Loading User
                        </p>
                    </div>
                </main>
            }
        >
            <EditUserPageContent />
        </Suspense>
    );
}
