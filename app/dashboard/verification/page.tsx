"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
    getCurrentUser,
} from "@/lib/appwrite/account";

import {
    getCurrentMember,
    type MemberRow,
} from "@/lib/appwrite/database";

import ProfessionalVerificationForm from "@/components/auth/ProfessionalVerificationForm";

export default function ProfessionalVerificationPage() {

    const [member, setMember] =
        useState<MemberRow | null>(null);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {

        const loadMember = async () => {

            try {

                const user =
                    await getCurrentUser();

                const currentMember =
                    await getCurrentMember(user.$id);

                setMember(currentMember);

            } catch (error) {

                console.error(
                    "Verification page loading error:",
                    error
                );

                window.location.href = "/login";

            } finally {

                setLoading(false);

            }

        };

        loadMember();

    }, []);


    if (loading) {

        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9]">

                <div className="text-center">

                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />

                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                        Loading Verification
                    </p>

                </div>

            </main>
        );

    }


    if (!member) {

        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f5f7f9]">

                <div className="border border-slate-200 bg-white p-8 text-center">

                    <h1 className="text-xl font-bold text-slate-950">
                        Profile Not Found
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        We could not find your HomeMate profile.
                    </p>

                    <Link
                        href="/dashboard"
                        className="mt-6 inline-block bg-slate-950 px-5 py-3 text-xs font-bold text-white"
                    >
                        Back to Dashboard
                    </Link>

                </div>

            </main>
        );

    }


    /* ============================================================
       ROLE PROTECTION
    ============================================================ */

    if (member.role !== "professional") {

        return (
            <main className="min-h-screen bg-[#f5f7f9]">

                <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5">

                    <div className="w-full border border-slate-200 bg-white p-8 text-center sm:p-12">

                        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-slate-200 bg-slate-50 text-xl">
                            !
                        </div>

                        <h1 className="mt-6 text-2xl font-bold text-slate-950">
                            Professional Verification
                        </h1>

                        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                            This verification process is only available
                            for HomeMate professional accounts.
                        </p>

                        <Link
                            href="/dashboard"
                            className="mt-7 inline-block bg-slate-950 px-6 py-3 text-xs font-bold text-white transition hover:bg-slate-800"
                        >
                            Back to Dashboard
                        </Link>

                    </div>

                </div>

            </main>
        );

    }


    return (
        <main className="min-h-screen bg-[#f5f7f9]">


            {/* =====================================================
                HEADER
            ===================================================== */}

            <header className="border-b border-slate-200 bg-white">

                <div className="mx-auto flex h-[76px] max-w-5xl items-center justify-between px-5 sm:px-8">

                    <div>

                        <p className="text-lg font-bold text-slate-950">
                            HomeMate
                        </p>

                        <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Professional Verification
                        </p>

                    </div>


                    <Link
                        href="/dashboard"
                        className="border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                    >
                        ← Dashboard
                    </Link>

                </div>

            </header>


            {/* =====================================================
                CONTENT
            ===================================================== */}

            <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">

                {/* Heading */}

                <div className="mb-8">

                    <div className="mb-4 flex items-center gap-3">

                        <span className="h-px w-10 bg-[#caa66a]" />

                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                            Verification
                        </span>

                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                        Verify your professional account
                    </h1>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                        Submit your professional license and certificate
                        so the HomeMate team can review and verify your
                        professional profile.
                    </p>

                </div>


                {/* Current Status */}

                <div className="mb-6 border border-slate-200 bg-white p-6">

                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

                        <div>

                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Current KYC Status
                            </p>

                            <div className="mt-2 flex items-center gap-3">

                                <span
                                    className={`h-2.5 w-2.5 rounded-full ${
                                        member.verificationStatus === "Approved"
                                            ? "bg-emerald-500"
                                            : member.verificationStatus === "Rejected"
                                                ? "bg-red-500"
                                                : "bg-amber-500"
                                    }`}
                                />

                                <p className="text-lg font-bold text-slate-950">
                                    {member.verificationStatus}
                                </p>

                            </div>

                        </div>


                        {member.verificationSubmittedAt && (
                            <div className="text-left sm:text-right">

                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Last Submitted
                                </p>

                                <p className="mt-2 text-sm font-semibold text-slate-700">
                                    {new Date(
                                        member.verificationSubmittedAt
                                    ).toLocaleDateString(
                                        "en-IN",
                                        {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        }
                                    )}
                                </p>

                            </div>
                        )}

                    </div>

                </div>


                {/* Form */}

                <div className="border border-slate-200 bg-white p-6 sm:p-8">

                    <ProfessionalVerificationForm
                        memberId={member.$id}
                        existingLicense={
                            member.licenseDocument
                        }
                        existingCertificate={
                            member.certificateDocument
                        }
                    />

                </div>

            </div>

        </main>
    );
}