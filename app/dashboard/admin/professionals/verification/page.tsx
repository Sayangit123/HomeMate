"use client";

import { useMemo } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import Swal from "sweetalert2";

import { getAllMembers } from "@/lib/appwrite/member";
import { Databases } from "appwrite";
import client from "@/lib/appwrite/client";

import {
    useAdminProfessionalVerificationStore,
} from "@/lib/stores/admin-professional-verification-store";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MEMBERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";

interface Professional {
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
    verificationStatus: string;
    licenseDocument?: string | null;
    certificateDocument?: string | null;
    verificationSubmittedAt?: string | null;
    $createdAt?: string;
    $updatedAt?: string;
}

export default function ProfessionalVerificationPage() {
    const queryClient = useQueryClient();

    const {
        statusFilter,
        setStatusFilter,
    } = useAdminProfessionalVerificationStore();

    /* ============================================================
       LOAD PROFESSIONALS - TANSTACK QUERY
    ============================================================ */

    const professionalsQuery = useQuery({
        queryKey: [
            "admin",
            "professional-verification",
        ],

        queryFn: async () => {
            try {
                const response =
                    await getAllMembers();

                const allMembers =
                    response.documents as unknown as Professional[];

                return allMembers.filter(
                    (member) =>
                        member.role === "professional"
                );
            } catch (error) {
                console.error(
                    "Unable to load professionals:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Unable to Load Professionals",
                    text: "Something went wrong while loading professional verification records.",
                    confirmButtonColor:
                        "#0f172a",
                });

                throw error;
            }
        },
    });

    const professionals =
        professionalsQuery.data || [];

    /* ============================================================
       FILTER
    ============================================================ */

    const filteredProfessionals =
        useMemo(() => {
            if (statusFilter === "all") {
                return professionals;
            }

            return professionals.filter(
                (professional) =>
                    professional.verificationStatus ===
                    statusFilter
            );
        }, [
            professionals,
            statusFilter,
        ]);

    /* ============================================================
       COUNTS
    ============================================================ */

    const pendingCount =
        professionals.filter(
            (professional) =>
                professional.verificationStatus ===
                "Pending"
        ).length;

    const approvedCount =
        professionals.filter(
            (professional) =>
                professional.verificationStatus ===
                "Approved"
        ).length;

    const rejectedCount =
        professionals.filter(
            (professional) =>
                professional.verificationStatus ===
                "Rejected"
        ).length;

    /* ============================================================
       DATE FORMAT
    ============================================================ */

    const formatDate = (
        date?: string | null
    ) => {
        if (!date) {
            return "—";
        }

        const parsedDate =
            new Date(date);

        if (
            Number.isNaN(
                parsedDate.getTime()
            )
        ) {
            return "—";
        }

        return parsedDate.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

    /* ============================================================
       VERIFICATION BADGE
    ============================================================ */

    const getVerificationBadgeClass =
        (status: string) => {
            switch (status) {
                case "Approved":
                    return "bg-emerald-50 text-emerald-700";

                case "Pending":
                    return "bg-amber-50 text-amber-700";

                case "Rejected":
                    return "bg-red-50 text-red-700";

                default:
                    return "bg-slate-100 text-slate-600";
            }
        };

    /* ============================================================
       VIEW DOCUMENT INFORMATION
    ============================================================ */

    const handleViewDocuments =
        async (
            professional: Professional
        ) => {
            const licenseText =
                professional.licenseDocument
                    ? "Submitted"
                    : "Not Submitted";

            const certificateText =
                professional.certificateDocument
                    ? "Submitted"
                    : "Not Submitted";

            await Swal.fire({
                title: "Verification Documents",

                html: `
                    <div style="text-align:left;line-height:1.9">

                        <p>
                            <strong>Professional:</strong>
                            ${professional.fullName}
                        </p>

                        <p>
                            <strong>Phone:</strong>
                            ${
                                professional.phone ||
                                "Not provided"
                            }
                        </p>

                        <p>
                            <strong>Profile Completion:</strong>
                            ${
                                professional.profileCompletion
                            }%
                        </p>

                        <hr style="margin:12px 0" />

                        <p>
                            <strong>License Document:</strong>
                            ${licenseText}
                        </p>

                        <p>
                            <strong>Certificate Document:</strong>
                            ${certificateText}
                        </p>

                        <p>
                            <strong>Submitted At:</strong>
                            ${
                                professional.verificationSubmittedAt
                                    ? formatDate(
                                          professional.verificationSubmittedAt
                                      )
                                    : "Not submitted"
                            }
                        </p>

                    </div>
                `,

                confirmButtonText: "Close",

                confirmButtonColor:
                    "#0f172a",
            });
        };

    /* ============================================================
       UPDATE VERIFICATION STATUS
       TANSTACK MUTATION
    ============================================================ */

    const verificationMutation =
        useMutation({
            mutationFn: async ({
                professionalId,
                status,
            }: {
                professionalId: string;
                status:
                    | "Approved"
                    | "Rejected";
            }) => {
                await databases.updateDocument(
                    DATABASE_ID,
                    MEMBERS_TABLE_ID,
                    professionalId,
                    {
                        verificationStatus:
                            status,
                    }
                );
            },

            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: [
                        "admin",
                        "professional-verification",
                    ],
                });
            },
        });

    /* ============================================================
       UPDATE STATUS HANDLER
    ============================================================ */

    const updateVerificationStatus =
        async (
            professional: Professional,
            status:
                | "Approved"
                | "Rejected"
        ) => {
            const isApprove =
                status === "Approved";

            const result =
                await Swal.fire({
                    icon: isApprove
                        ? "question"
                        : "warning",

                    title: isApprove
                        ? "Approve Professional?"
                        : "Reject Professional?",

                    text: isApprove
                        ? `Are you sure you want to approve ${professional.fullName}?`
                        : `Are you sure you want to reject ${professional.fullName}?`,

                    showCancelButton: true,

                    confirmButtonText:
                        isApprove
                            ? "Yes, Approve"
                            : "Yes, Reject",

                    cancelButtonText:
                        "Cancel",

                    confirmButtonColor:
                        isApprove
                            ? "#047857"
                            : "#b91c1c",

                    cancelButtonColor:
                        "#64748b",

                    reverseButtons: true,
                });

            if (!result.isConfirmed) {
                return;
            }

            try {
                await verificationMutation.mutateAsync({
                    professionalId:
                        professional.$id,
                    status,
                });

                await Swal.fire({
                    icon: "success",

                    title: isApprove
                        ? "Professional Approved"
                        : "Professional Rejected",

                    text: isApprove
                        ? `${professional.fullName} has been approved successfully.`
                        : `${professional.fullName} has been rejected.`,

                    confirmButtonColor:
                        "#0f172a",

                    timer: 1800,

                    timerProgressBar: true,
                });
            } catch (error) {
                console.error(
                    "Unable to update verification status:",
                    error
                );

                await Swal.fire({
                    icon: "error",

                    title: "Update Failed",

                    text: "Something went wrong while updating the professional's verification status.",

                    confirmButtonColor:
                        "#0f172a",
                });
            }
        };

    /* ============================================================
       RENDER
    ============================================================ */

    return (
        <main className="min-h-screen bg-slate-50 text-slate-950">

            {/* NAVBAR */}

            <header className="border-b border-slate-200 bg-white">

                <div className="mx-auto flex min-h-[82px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">

                    <Link
                        href="/dashboard/admin"
                        className="flex items-center gap-3"
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

                    </Link>

                    <div className="flex items-center gap-3">

                        <div className="hidden text-right sm:block">

                            <p className="text-xs font-bold text-slate-900">
                                Super Admin
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                                Professional Verification
                            </p>

                        </div>

                        <div className="flex h-10 w-10 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                            A
                        </div>

                    </div>

                </div>

            </header>

            {/* MAIN */}

            <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">

                {/* PAGE HEADER */}

                <section className="mb-8">

                    <div className="mb-4 flex items-center gap-3">

                        <span className="h-px w-10 bg-[#caa66a]" />

                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                            Administration / Professionals / Verification
                        </span>

                    </div>

                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

                        <div>

                            <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                                Professional Verification
                            </h2>

                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                                Review professional accounts
                                and manage their verification
                                status before they provide
                                services on HomeMate.
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                professionalsQuery.refetch()
                            }
                            className="border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                        >
                            ↻ Refresh
                        </button>

                    </div>

                </section>

                {/* SUMMARY */}

                <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                    <div className="border border-slate-200 bg-white p-6">

                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Total
                        </p>

                        <p className="mt-5 text-3xl font-bold text-slate-950">
                            {professionals.length}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                            Professional accounts
                        </p>

                    </div>

                    <div className="border border-slate-200 bg-white p-6">

                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Pending
                        </p>

                        <p className="mt-5 text-3xl font-bold text-amber-700">
                            {pendingCount}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                            Awaiting review
                        </p>

                    </div>

                    <div className="border border-slate-200 bg-white p-6">

                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Approved
                        </p>

                        <p className="mt-5 text-3xl font-bold text-emerald-700">
                            {approvedCount}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                            Verified professionals
                        </p>

                    </div>

                    <div className="border border-slate-200 bg-white p-6">

                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Rejected
                        </p>

                        <p className="mt-5 text-3xl font-bold text-red-700">
                            {rejectedCount}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                            Rejected applications
                        </p>

                    </div>

                </section>

                {/* FILTER */}

                <section className="mb-6 border border-slate-200 bg-white p-5">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                        <div>

                            <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Verification Status
                            </label>

                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(
                                        event.target
                                            .value as typeof statusFilter
                                    )
                                }
                                className="w-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-950 sm:w-64"
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

                                <option value="all">
                                    All Professionals
                                </option>

                            </select>

                        </div>

                        <p className="text-xs text-slate-400">

                            Showing{" "}

                            <span className="font-bold text-slate-900">
                                {
                                    filteredProfessionals.length
                                }
                            </span>{" "}

                            professional
                            {filteredProfessionals.length !==
                            1
                                ? "s"
                                : ""}

                        </p>

                    </div>

                </section>

                {/* TABLE */}

                <section className="border border-slate-200 bg-white">

                    <div className="border-b border-slate-200 px-6 py-5">

                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">

                            <div>

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Verification Queue
                                </p>

                                <h3 className="mt-1 text-lg font-bold text-slate-950">
                                    Professional Applications
                                </h3>

                            </div>

                            <p className="text-xs text-slate-400">
                                Review submitted professional
                                credentials
                            </p>

                        </div>

                    </div>

                    {professionalsQuery.isLoading ? (

                        <div className="flex min-h-[300px] items-center justify-center">

                            <div className="text-center">

                                <div className="mx-auto mb-4 h-8 w-8 animate-spin border-2 border-slate-200 border-t-slate-950" />

                                <p className="text-sm text-slate-500">
                                    Loading verification
                                    records...
                                </p>

                            </div>

                        </div>

                    ) : filteredProfessionals.length ===
                      0 ? (

                        <div className="flex min-h-[300px] items-center justify-center px-6">

                            <div className="text-center">

                                <div className="mx-auto flex h-14 w-14 items-center justify-center border border-slate-200 bg-slate-50 text-2xl">
                                    ✓
                                </div>

                                <h4 className="mt-5 text-lg font-bold text-slate-950">
                                    No Applications Found
                                </h4>

                                <p className="mt-2 text-sm text-slate-500">
                                    There are no professionals
                                    matching the selected
                                    verification status.
                                </p>

                            </div>

                        </div>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="min-w-[1200px] w-full">

                                <thead className="bg-slate-50">

                                    <tr className="border-b border-slate-200">

                                        <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                            Professional
                                        </th>

                                        <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                            Phone
                                        </th>

                                        <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                            Profile
                                        </th>

                                        <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                            Documents
                                        </th>

                                        <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                            Submitted
                                        </th>

                                        <th className="px-5 py-4 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                            Status
                                        </th>

                                        <th className="px-5 py-4 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                            Action
                                        </th>

                                    </tr>

                                </thead>

                                <tbody className="divide-y divide-slate-100">

                                    {filteredProfessionals.map(
                                        (professional) => (
                                            <tr
                                                key={
                                                    professional.$id
                                                }
                                                className="transition hover:bg-slate-50"
                                            >

                                                {/* PROFESSIONAL */}

                                                <td className="px-5 py-5">

                                                    <div className="flex items-center gap-3">

                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-950 text-xs font-bold text-white">
                                                            {professional.fullName
                                                                .charAt(
                                                                    0
                                                                )
                                                                .toUpperCase()}
                                                        </div>

                                                        <div>

                                                            <p className="text-sm font-bold text-slate-950">
                                                                {
                                                                    professional.fullName
                                                                }
                                                            </p>

                                                            <p className="mt-1 font-mono text-[10px] text-slate-400">
                                                                {
                                                                    professional.userId
                                                                }
                                                            </p>

                                                        </div>

                                                    </div>

                                                </td>

                                                {/* PHONE */}

                                                <td className="px-5 py-5 text-sm text-slate-600">

                                                    {
                                                        professional.phone ||
                                                        "Not provided"
                                                    }

                                                </td>

                                                {/* PROFILE */}

                                                <td className="px-5 py-5">

                                                    <div className="flex items-center gap-3">

                                                        <span
                                                            className={`text-xs font-bold ${
                                                                professional.profileCompletion >=
                                                                80
                                                                    ? "text-emerald-700"
                                                                    : professional.profileCompletion >=
                                                                        50
                                                                      ? "text-amber-700"
                                                                      : "text-red-700"
                                                            }`}
                                                        >
                                                            {
                                                                professional.profileCompletion
                                                            }
                                                            %
                                                        </span>

                                                        <div className="h-1.5 w-20 bg-slate-100">

                                                            <div
                                                                className="h-full bg-slate-950"
                                                                style={{
                                                                    width: `${Math.min(
                                                                        Math.max(
                                                                            professional.profileCompletion,
                                                                            0
                                                                        ),
                                                                        100
                                                                    )}%`,
                                                                }}
                                                            />

                                                        </div>

                                                    </div>

                                                </td>

                                                {/* DOCUMENTS */}

                                                <td className="px-5 py-5">

                                                    <div className="space-y-1 text-[10px]">

                                                        <p
                                                            className={
                                                                professional.licenseDocument
                                                                    ? "font-bold text-emerald-700"
                                                                    : "text-slate-400"
                                                            }
                                                        >
                                                            License:{" "}

                                                            {
                                                                professional.licenseDocument
                                                                    ? "Submitted"
                                                                    : "Missing"
                                                            }

                                                        </p>

                                                        <p
                                                            className={
                                                                professional.certificateDocument
                                                                    ? "font-bold text-emerald-700"
                                                                    : "text-slate-400"
                                                            }
                                                        >
                                                            Certificate:{" "}

                                                            {
                                                                professional.certificateDocument
                                                                    ? "Submitted"
                                                                    : "Missing"
                                                            }

                                                        </p>

                                                    </div>

                                                </td>

                                                {/* SUBMITTED */}

                                                <td className="px-5 py-5 text-xs text-slate-500">

                                                    {
                                                        professional.verificationSubmittedAt
                                                            ? formatDate(
                                                                  professional.verificationSubmittedAt
                                                              )
                                                            : "Not submitted"
                                                    }

                                                </td>

                                                {/* STATUS */}

                                                <td className="px-5 py-5">

                                                    <span
                                                        className={`inline-flex px-2.5 py-1 text-[9px] font-bold uppercase ${getVerificationBadgeClass(
                                                            professional.verificationStatus
                                                        )}`}
                                                    >
                                                        {
                                                            professional.verificationStatus
                                                        }
                                                    </span>

                                                </td>

                                                {/* ACTION */}

                                                <td className="px-5 py-5">

                                                    <div className="flex justify-end gap-2">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleViewDocuments(
                                                                    professional
                                                                )
                                                            }
                                                            className="border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                                                        >
                                                            View
                                                        </button>

                                                        {professional.verificationStatus !==
                                                            "Approved" && (
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    verificationMutation.isPending
                                                                }
                                                                onClick={() =>
                                                                    updateVerificationStatus(
                                                                        professional,
                                                                        "Approved"
                                                                    )
                                                                }
                                                                className="border border-emerald-700 bg-emerald-700 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {verificationMutation.isPending
                                                                    ? "..."
                                                                    : "Approve"}
                                                            </button>
                                                        )}

                                                        {professional.verificationStatus !==
                                                            "Rejected" && (
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    verificationMutation.isPending
                                                                }
                                                                onClick={() =>
                                                                    updateVerificationStatus(
                                                                        professional,
                                                                        "Rejected"
                                                                    )
                                                                }
                                                                className="border border-red-700 bg-red-700 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {verificationMutation.isPending
                                                                    ? "..."
                                                                    : "Reject"}
                                                            </button>
                                                        )}

                                                    </div>

                                                </td>

                                            </tr>
                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>

                    )}

                </section>

                {/* BACK LINKS */}

                <div className="mt-6 flex flex-wrap gap-5">

                    <Link
                        href="/dashboard/admin/professionals"
                        className="text-xs font-bold text-slate-500 transition hover:text-slate-950"
                    >
                        ← Professional Management
                    </Link>

                    <Link
                        href="/dashboard/admin"
                        className="text-xs font-bold text-slate-500 transition hover:text-slate-950"
                    >
                        ← Admin Dashboard
                    </Link>

                </div>

                {/* FOOTER */}

                <footer className="mt-10 border-t border-slate-200 py-6">

                    <div className="flex flex-col justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:flex-row">

                        <p>
                            HomeMate • Home Services & Community Platform
                        </p>

                        <p>
                            Super Admin • Professional Verification
                        </p>

                    </div>

                </footer>

            </div>

        </main>
    );
}