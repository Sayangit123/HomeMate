"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Swal from "sweetalert2";

import {
    Databases,
    Query,
} from "appwrite";

import client from "@/lib/appwrite/client";


/* ============================================================
   APPWRITE
============================================================ */

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MEMBERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";


/* ============================================================
   MEMBER TYPE
============================================================ */

interface Member {
    $id: string;
    userId: string;
    fullName: string;
    phone?: string;
    role: "customer" | "professional" | "business";
}


/* ============================================================
   PAGE
============================================================ */

export default function PromotionalNotificationPage() {

    /* ==========================================================
       FORM STATE
    ========================================================== */

    const [title, setTitle] =
        useState("");

    const [message, setMessage] =
        useState("");

    const [sendTo, setSendTo] =
        useState<"all" | "selected">(
            "all"
        );

    const [selectedUsers, setSelectedUsers] =
        useState<string[]>([]);


    /* ==========================================================
       USER DATA
    ========================================================== */

    const [members, setMembers] =
        useState<Member[]>([]);

    const [loadingMembers, setLoadingMembers] =
        useState(false);

    const [sending, setSending] =
        useState(false);


    /* ============================================================
       LOAD MEMBERS
    ============================================================ */

    useEffect(() => {

        const loadMembers = async () => {

            try {

                setLoadingMembers(true);

                const response =
                    await databases.listDocuments(
                        DATABASE_ID,
                        MEMBERS_TABLE_ID,
                        [
                            Query.limit(100),
                        ]
                    );


                const users =
                    response.documents.map(
                        (document) =>
                            document as unknown as Member
                    );


                setMembers(users);

            } catch (error) {

                console.error(
                    "Unable to load members:",
                    error
                );

            } finally {

                setLoadingMembers(false);
            }
        };


        loadMembers();

    }, []);


    /* ============================================================
       USER SELECTION
    ============================================================ */

    const toggleUser = (
        userId: string
    ) => {

        setSelectedUsers(
            (previous) => {

                if (
                    previous.includes(
                        userId
                    )
                ) {

                    return previous.filter(
                        (id) =>
                            id !== userId
                    );
                }

                return [
                    ...previous,
                    userId,
                ];
            }
        );
    };


    /* ============================================================
       SELECT ALL
    ============================================================ */

    const selectAllUsers = () => {

        setSelectedUsers(
            members.map(
                (member) =>
                    member.userId
            )
        );
    };


    /* ============================================================
       CLEAR USERS
    ============================================================ */

    const clearSelectedUsers = () => {

        setSelectedUsers([]);

    };


    /* ============================================================
       SUBMIT
    ============================================================ */

    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {

        event.preventDefault();


        /* ========================================================
           VALIDATION
        ======================================================== */

        const trimmedTitle =
            title.trim();

        const trimmedMessage =
            message.trim();


        if (!trimmedTitle) {

            await Swal.fire({
                icon: "warning",
                title: "Title Required",
                text:
                    "Please enter a promotional notification title.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }


        if (!trimmedMessage) {

            await Swal.fire({
                icon: "warning",
                title: "Message Required",
                text:
                    "Please enter a promotional message.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }


        if (
            sendTo === "selected" &&
            selectedUsers.length === 0
        ) {

            await Swal.fire({
                icon: "warning",
                title: "Select Users",
                text:
                    "Please select at least one user.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }


        try {

            setSending(true);


            /* ====================================================
               API PAYLOAD
            ==================================================== */

            const payload = {

                title:
                    trimmedTitle,

                message:
                    trimmedMessage,

                ...(sendTo === "selected"
                    ? {
                          userIds:
                              selectedUsers,
                      }
                    : {}),
            };


            /* ====================================================
               SEND REQUEST
            ==================================================== */

            const response =
                await fetch(
                    "/api/notifications/promotional",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                payload
                            ),
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.message ||
                        "Unable to send promotional notification."
                );
            }


            /* ====================================================
               SUCCESS
            ==================================================== */

            await Swal.fire({

                icon: "success",

                title:
                    "Promotion Sent",

                text:
                    `${result.createdCount || 0} promotional notification(s) were created successfully.`,

                confirmButtonText:
                    "Great",

                confirmButtonColor:
                    "#0f172a",
            });


            /* ====================================================
               RESET FORM
            ==================================================== */

            setTitle("");

            setMessage("");

            setSendTo("all");

            setSelectedUsers([]);


        } catch (error: unknown) {

            console.error(
                "Promotional notification error:",
                error
            );


            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Unable to send promotional notification.";


            await Swal.fire({

                icon: "error",

                title:
                    "Notification Failed",

                text:
                    errorMessage,

                confirmButtonText:
                    "Try Again",

                confirmButtonColor:
                    "#0f172a",
            });

        } finally {

            setSending(false);
        }
    };


    /* ============================================================
       PAGE
    ============================================================ */

    return (

        <main className="min-h-screen bg-[#f5f7f9]">

            {/* ====================================================
                NAVBAR
            ==================================================== */}

            <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">

                <div className="mx-auto flex min-h-[76px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">

                    {/* Brand */}

                    <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                            H
                        </div>

                        <div className="min-w-0">

                            <h1 className="text-lg font-bold tracking-tight text-slate-950">
                                HomeMate
                            </h1>

                            <p className="truncate text-[8px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                Home Services Platform
                            </p>

                        </div>

                    </div>


                    {/* Back button */}

                    <Link
                        href="/dashboard/notifications"
                        className="border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                    >
                        ← Notifications
                    </Link>

                </div>

            </header>


            {/* ====================================================
                CONTENT
            ==================================================== */}

            <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:px-10">


                {/* ==================================================
                    PAGE HEADER
                ================================================== */}

                <section className="mb-8">

                    <div className="mb-4 flex items-center gap-3">

                        <span className="h-px w-10 bg-[#caa66a]" />

                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                            Notification Management
                        </span>

                    </div>


                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">

                        <div>

                            <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                                Promotional Notifications
                            </h2>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                                Send special offers, discounts and
                                promotional announcements to HomeMate
                                users.
                            </p>

                        </div>


                        <div className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-3">

                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />

                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Promotional
                            </span>

                        </div>

                    </div>

                </section>


                {/* ==================================================
                    MAIN GRID
                ================================================== */}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">


                    {/* ==================================================
                        FORM
                    ================================================== */}

                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="border border-slate-200 bg-white"
                    >

                        {/* Form header */}

                        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">

                            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                Create Promotion
                            </p>

                            <h3 className="mt-1 text-lg font-bold text-slate-950">
                                Compose Notification
                            </h3>

                        </div>


                        <div className="space-y-6 px-6 py-7 sm:px-8">


                            {/* ==================================================
                                TITLE
                            ================================================== */}

                            <div>

                                <label
                                    htmlFor="title"
                                    className="mb-2 block text-xs font-bold text-slate-700"
                                >
                                    Notification Title
                                    <span className="ml-1 text-red-500">
                                        *
                                    </span>
                                </label>


                                <input
                                    id="title"
                                    type="text"
                                    value={title}
                                    onChange={(
                                        event
                                    ) =>
                                        setTitle(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Example: HomeMate Summer Offer"
                                    maxLength={150}
                                    className="h-12 w-full border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5"
                                />


                                <div className="mt-2 flex justify-end">

                                    <span className="text-[10px] text-slate-400">
                                        {title.length}/150
                                    </span>

                                </div>

                            </div>


                            {/* ==================================================
                                MESSAGE
                            ================================================== */}

                            <div>

                                <label
                                    htmlFor="message"
                                    className="mb-2 block text-xs font-bold text-slate-700"
                                >
                                    Promotional Message
                                    <span className="ml-1 text-red-500">
                                        *
                                    </span>
                                </label>


                                <textarea
                                    id="message"
                                    value={message}
                                    onChange={(
                                        event
                                    ) =>
                                        setMessage(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Write your promotional offer or announcement here..."
                                    maxLength={500}
                                    rows={6}
                                    className="w-full resize-none border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5"
                                />


                                <div className="mt-2 flex justify-end">

                                    <span className="text-[10px] text-slate-400">
                                        {message.length}/500
                                    </span>

                                </div>

                            </div>


                            {/* ==================================================
                                SEND TO
                            ================================================== */}

                            <div>

                                <p className="mb-3 text-xs font-bold text-slate-700">
                                    Send To
                                </p>


                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">


                                    {/* ALL USERS */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSendTo(
                                                "all"
                                            )
                                        }
                                        className={`border p-4 text-left transition ${
                                            sendTo ===
                                            "all"
                                                ? "border-slate-950 bg-slate-950 text-white"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                                        }`}
                                    >

                                        <div className="flex items-center gap-3">

                                            <span
                                                className={`flex h-5 w-5 items-center justify-center border ${
                                                    sendTo ===
                                                    "all"
                                                        ? "border-white bg-white text-slate-950"
                                                        : "border-slate-300"
                                                }`}
                                            >
                                                {sendTo ===
                                                    "all" &&
                                                    "✓"}
                                            </span>


                                            <div>

                                                <p className="text-xs font-bold">
                                                    All HomeMate Users
                                                </p>

                                                <p
                                                    className={`mt-1 text-[10px] ${
                                                        sendTo ===
                                                        "all"
                                                            ? "text-slate-300"
                                                            : "text-slate-400"
                                                    }`}
                                                >
                                                    Send to every registered member
                                                </p>

                                            </div>

                                        </div>

                                    </button>


                                    {/* SELECTED USERS */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSendTo(
                                                "selected"
                                            )
                                        }
                                        className={`border p-4 text-left transition ${
                                            sendTo ===
                                            "selected"
                                                ? "border-slate-950 bg-slate-950 text-white"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                                        }`}
                                    >

                                        <div className="flex items-center gap-3">

                                            <span
                                                className={`flex h-5 w-5 items-center justify-center border ${
                                                    sendTo ===
                                                    "selected"
                                                        ? "border-white bg-white text-slate-950"
                                                        : "border-slate-300"
                                                }`}
                                            >
                                                {sendTo ===
                                                    "selected" &&
                                                    "✓"}
                                            </span>


                                            <div>

                                                <p className="text-xs font-bold">
                                                    Selected Users
                                                </p>

                                                <p
                                                    className={`mt-1 text-[10px] ${
                                                        sendTo ===
                                                        "selected"
                                                            ? "text-slate-300"
                                                            : "text-slate-400"
                                                    }`}
                                                >
                                                    Choose specific HomeMate users
                                                </p>

                                            </div>

                                        </div>

                                    </button>

                                </div>

                            </div>


                            {/* ==================================================
                                USER SELECTION
                            ================================================== */}

                            {sendTo ===
                                "selected" && (

                                <div className="border border-slate-200 bg-slate-50">

                                    {/* Selection header */}

                                    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center">

                                        <div>

                                            <p className="text-xs font-bold text-slate-900">
                                                Select Recipients
                                            </p>

                                            <p className="mt-1 text-[10px] text-slate-400">
                                                {selectedUsers.length} user(s) selected
                                            </p>

                                        </div>


                                        <div className="flex gap-2">

                                            <button
                                                type="button"
                                                onClick={
                                                    selectAllUsers
                                                }
                                                disabled={
                                                    loadingMembers ||
                                                    members.length ===
                                                        0
                                                }
                                                className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Select All
                                            </button>


                                            <button
                                                type="button"
                                                onClick={
                                                    clearSelectedUsers
                                                }
                                                disabled={
                                                    selectedUsers.length ===
                                                    0
                                                }
                                                className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-red-500 hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Clear
                                            </button>

                                        </div>

                                    </div>


                                    {/* Members */}

                                    <div className="max-h-[330px] overflow-y-auto">

                                        {loadingMembers ? (

                                            <div className="flex items-center justify-center px-4 py-10">

                                                <div className="text-center">

                                                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />

                                                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        Loading users...
                                                    </p>

                                                </div>

                                            </div>

                                        ) : members.length ===
                                          0 ? (

                                            <div className="px-4 py-10 text-center">

                                                <p className="text-sm font-bold text-slate-700">
                                                    No users found
                                                </p>

                                                <p className="mt-1 text-xs text-slate-400">
                                                    HomeMate members could not be loaded.
                                                </p>

                                            </div>

                                        ) : (

                                            <div>

                                                {members.map(
                                                    (
                                                        member
                                                    ) => {

                                                        const isSelected =
                                                            selectedUsers.includes(
                                                                member.userId
                                                            );


                                                        return (

                                                            <button
                                                                key={
                                                                    member.$id
                                                                }
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleUser(
                                                                        member.userId
                                                                    )
                                                                }
                                                                className={`flex w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left transition last:border-b-0 ${
                                                                    isSelected
                                                                        ? "bg-white"
                                                                        : "hover:bg-white"
                                                                }`}
                                                            >

                                                                <span
                                                                    className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                                                                        isSelected
                                                                            ? "border-slate-950 bg-slate-950 text-xs text-white"
                                                                            : "border-slate-300 bg-white"
                                                                    }`}
                                                                >
                                                                    {isSelected &&
                                                                        "✓"}
                                                                </span>


                                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                                                                    {member.fullName
                                                                        ?.charAt(
                                                                            0
                                                                        )
                                                                        ?.toUpperCase() ||
                                                                        "U"}
                                                                </div>


                                                                <div className="min-w-0 flex-1">

                                                                    <p className="truncate text-xs font-bold text-slate-900">
                                                                        {
                                                                            member.fullName
                                                                        }
                                                                    </p>

                                                                    <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-400">
                                                                        {
                                                                            member.role
                                                                        }
                                                                    </p>

                                                                </div>

                                                            </button>

                                                        );
                                                    }
                                                )}

                                            </div>

                                        )}

                                    </div>

                                </div>

                            )}


                            {/* ==================================================
                                SUBMIT
                            ================================================== */}

                            <div className="border-t border-slate-100 pt-6">

                                <button
                                    type="submit"
                                    disabled={
                                        sending
                                    }
                                    className="flex h-13 w-full items-center justify-center gap-3 bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >

                                    {sending ? (

                                        <>
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                                            Sending Promotion...
                                        </>

                                    ) : (

                                        <>
                                            <span className="text-lg">
                                                🔔
                                            </span>

                                            Send Promotional Notification
                                        </>

                                    )}

                                </button>

                            </div>

                        </div>

                    </form>


                    {/* ==================================================
                        INFORMATION PANEL
                    ================================================== */}

                    <aside className="space-y-6">


                        {/* ==================================================
                            PREVIEW
                        ================================================== */}

                        <div className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-5 py-4">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Preview
                                </p>

                                <h3 className="mt-1 text-sm font-bold text-slate-950">
                                    Notification Preview
                                </h3>

                            </div>


                            <div className="p-5">

                                <div className="border border-slate-200 bg-slate-50 p-4">

                                    <div className="flex gap-3">

                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-950 text-lg text-white">
                                            🔔
                                        </div>


                                        <div className="min-w-0">

                                            <p className="break-words text-xs font-bold text-slate-950">
                                                {title.trim() ||
                                                    "Your notification title"}
                                            </p>


                                            <p className="mt-1 break-words text-[11px] leading-5 text-slate-500">
                                                {message.trim() ||
                                                    "Your promotional message will appear here."}
                                            </p>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>


                        {/* ==================================================
                            RECIPIENT SUMMARY
                        ================================================== */}

                        <div className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-5 py-4">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Recipients
                                </p>

                                <h3 className="mt-1 text-sm font-bold text-slate-950">
                                    Delivery Summary
                                </h3>

                            </div>


                            <div className="px-5">

                                <div className="flex items-center justify-between border-b border-slate-100 py-4">

                                    <span className="text-xs text-slate-500">
                                        Audience
                                    </span>

                                    <span className="text-xs font-bold capitalize text-slate-950">
                                        {sendTo ===
                                        "all"
                                            ? "Everyone"
                                            : "Selected"}
                                    </span>

                                </div>


                                <div className="flex items-center justify-between py-4">

                                    <span className="text-xs text-slate-500">
                                        Recipients
                                    </span>

                                    <span className="text-xs font-bold text-slate-950">

                                        {sendTo ===
                                        "all"
                                            ? `${members.length || "All"} users`
                                            : `${selectedUsers.length} users`}

                                    </span>

                                </div>

                            </div>

                        </div>


                        {/* ==================================================
                            INFORMATION
                        ================================================== */}

                        <div className="border border-blue-100 bg-blue-50 p-5">

                            <div className="flex gap-3">

                                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-blue-600 text-xs font-bold text-white">
                                    i
                                </span>


                                <div>

                                    <p className="text-xs font-bold text-blue-900">
                                        About Promotional Notifications
                                    </p>

                                    <p className="mt-2 text-[11px] leading-5 text-blue-700">
                                        Promotional notifications are
                                        delivered to the selected HomeMate
                                        users and appear in their
                                        Notifications section.
                                    </p>

                                </div>

                            </div>

                        </div>


                        {/* ==================================================
                            BACK
                        ================================================== */}

                        <Link
                            href="/dashboard/notifications"
                            className="block border border-slate-200 bg-white px-5 py-4 text-center text-xs font-bold text-slate-600 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                        >
                            ← Back to Notifications
                        </Link>

                    </aside>

                </div>

            </div>

        </main>
    );
}