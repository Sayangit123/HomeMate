"use client";

import { useState } from "react";

import Swal from "sweetalert2";

import {
    uploadVerificationDocument,
} from "@/lib/appwrite/storage";

import {
    updateMemberVerification,
} from "@/lib/appwrite/database";

interface ProfessionalVerificationFormProps {
    memberId: string;
    existingLicense?: string | null;
    existingCertificate?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const validateFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
        return "Only PDF, JPG, JPEG, PNG and WebP files are allowed.";
    }

    if (file.size > MAX_FILE_SIZE) {
        return "File size must not exceed 10 MB.";
    }

    return "";
};

export default function ProfessionalVerificationForm({
    memberId,
    existingLicense,
    existingCertificate,
}: ProfessionalVerificationFormProps) {

    const [licenseFile, setLicenseFile] =
        useState<File | null>(null);

    const [certificateFile, setCertificateFile] =
        useState<File | null>(null);

    const [licenseError, setLicenseError] =
        useState("");

    const [certificateError, setCertificateError] =
        useState("");

    const [isSubmitting, setIsSubmitting] =
        useState(false);

    const handleLicenseChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];

        setLicenseError("");

        if (!file) {
            setLicenseFile(null);
            return;
        }

        const error = validateFile(file);

        if (error) {
            setLicenseError(error);
            setLicenseFile(null);
            event.target.value = "";
            return;
        }

        setLicenseFile(file);
    };

    const handleCertificateChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];

        setCertificateError("");

        if (!file) {
            setCertificateFile(null);
            return;
        }

        const error = validateFile(file);

        if (error) {
            setCertificateError(error);
            setCertificateFile(null);
            event.target.value = "";
            return;
        }

        setCertificateFile(file);
    };

    const handleSubmit = async () => {
        setLicenseError("");
        setCertificateError("");

        if (!licenseFile && !existingLicense) {
            setLicenseError(
                "Please upload your professional license."
            );
            return;
        }

        if (!certificateFile && !existingCertificate) {
            setCertificateError(
                "Please upload your professional certificate."
            );
            return;
        }

        try {
            setIsSubmitting(true);

            let licenseDocument =
                existingLicense || null;

            let certificateDocument =
                existingCertificate || null;

            /* Upload license */

            if (licenseFile) {
                const uploadedLicense =
                    await uploadVerificationDocument(
                        licenseFile
                    );

                licenseDocument =
                    uploadedLicense.$id;
            }

            /* Upload certificate */

            if (certificateFile) {
                const uploadedCertificate =
                    await uploadVerificationDocument(
                        certificateFile
                    );

                certificateDocument =
                    uploadedCertificate.$id;
            }

            /* Update Members row */

            await updateMemberVerification(
                memberId,
                {
                    licenseDocument,
                    certificateDocument,
                    verificationSubmittedAt:
                        new Date().toISOString(),
                    verificationStatus: "Pending",
                }
            );

            await Swal.fire({
                icon: "success",
                title: "Verification Submitted",
                text: "Your documents have been submitted successfully. Your verification status is now Pending.",
                confirmButtonText: "Continue",
                confirmButtonColor: "#0f172a",
            });

            setLicenseFile(null);
            setCertificateFile(null);

            window.location.reload();

        } catch (error) {
            console.error(
                "Verification submission error:",
                error
            );

            let message =
                "Something went wrong while submitting your documents.";

            if (error instanceof Error) {
                message = error.message;
            }

            await Swal.fire({
                icon: "error",
                title: "Submission Failed",
                text: message,
                confirmButtonText: "Try Again",
                confirmButtonColor: "#0f172a",
            });

        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">

            {/* =====================================================
                INFORMATION
            ===================================================== */}

            <div className="border border-slate-200 bg-slate-50 p-5">

                <div className="flex gap-4">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 bg-white text-sm font-bold text-slate-700">
                        ✓
                    </div>

                    <div>

                        <h3 className="text-sm font-bold text-slate-950">
                            Professional Verification
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            Upload valid professional documents to
                            complete your verification. Your documents
                            will be reviewed before your account is
                            approved.
                        </p>

                    </div>

                </div>

            </div>


            {/* =====================================================
                LICENSE
            ===================================================== */}

            <div>

                <div className="mb-3 flex items-start justify-between gap-4">

                    <div>

                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            Document 01
                        </p>

                        <h3 className="mt-1 text-base font-bold text-slate-950">
                            Professional License
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                            Upload your valid professional license.
                        </p>

                    </div>

                    {existingLicense && (
                        <span className="shrink-0 bg-emerald-50 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                            Uploaded
                        </span>
                    )}

                </div>


                <label
                    htmlFor="licenseDocument"
                    className={`flex cursor-pointer flex-col items-center justify-center border border-dashed p-8 text-center transition ${
                        licenseError
                            ? "border-red-400 bg-red-50/30"
                            : "border-slate-300 bg-white hover:border-slate-950 hover:bg-slate-50"
                    }`}
                >

                    <div className="flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50 text-lg">
                        ↑
                    </div>

                    <p className="mt-4 text-sm font-bold text-slate-900">
                        {licenseFile
                            ? licenseFile.name
                            : existingLicense
                                ? "License already uploaded"
                                : "Choose license document"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                        PDF, JPG, JPEG, PNG or WebP • Maximum 10 MB
                    </p>

                    <input
                        id="licenseDocument"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleLicenseChange}
                        className="hidden"
                    />

                </label>

                {licenseError && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                        {licenseError}
                    </p>
                )}

            </div>


            {/* =====================================================
                CERTIFICATE
            ===================================================== */}

            <div>

                <div className="mb-3 flex items-start justify-between gap-4">

                    <div>

                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            Document 02
                        </p>

                        <h3 className="mt-1 text-base font-bold text-slate-950">
                            Professional Certificate
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                            Upload a relevant professional certificate.
                        </p>

                    </div>

                    {existingCertificate && (
                        <span className="shrink-0 bg-emerald-50 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                            Uploaded
                        </span>
                    )}

                </div>


                <label
                    htmlFor="certificateDocument"
                    className={`flex cursor-pointer flex-col items-center justify-center border border-dashed p-8 text-center transition ${
                        certificateError
                            ? "border-red-400 bg-red-50/30"
                            : "border-slate-300 bg-white hover:border-slate-950 hover:bg-slate-50"
                    }`}
                >

                    <div className="flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50 text-lg">
                        ↑
                    </div>

                    <p className="mt-4 text-sm font-bold text-slate-900">
                        {certificateFile
                            ? certificateFile.name
                            : existingCertificate
                                ? "Certificate already uploaded"
                                : "Choose certificate document"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                        PDF, JPG, JPEG, PNG or WebP • Maximum 10 MB
                    </p>

                    <input
                        id="certificateDocument"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleCertificateChange}
                        className="hidden"
                    />

                </label>

                {certificateError && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                        {certificateError}
                    </p>
                )}

            </div>


            {/* =====================================================
                SUBMIT
            ===================================================== */}

            <div className="border-t border-slate-200 pt-6">

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting
                        ? "Submitting Documents..."
                        : "Submit for Verification →"}
                </button>

                <p className="mt-3 text-center text-[10px] leading-5 text-slate-400">
                    By submitting these documents, you confirm that the
                    information provided is accurate and belongs to you.
                </p>

            </div>

        </div>
    );
}