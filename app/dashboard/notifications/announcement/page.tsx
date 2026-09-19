"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import {
    getCurrentMember,
    type MemberRow,
} from "@/lib/appwrite/database";

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MEMBERS_TABLE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";

interface Recipient extends MemberRow {
    $id: string;
}

export default function SystemAnnouncementPage() {
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");

    const [audience, setAudience] =
        useState<"everyone" | "selected">(
            "everyone"
        );

    const [members, setMembers] =
        useState<Recipient[]>([]);

    const [selectedUsers, setSelectedUsers] =
        useState<string[]>([]);

    const [loadingMembers, setLoadingMembers] =
        useState(true);

    const [currentMember, setCurrentMember] =
        useState<MemberRow | null>(null);

    const [publishing, setPublishing] =
        useState(false);

    /* ============================================================
       LOAD MEMBERS
    ============================================================ */

    useEffect(() => {
        const loadMembers = async () => {
            try {
                setLoadingMembers(true);

                const currentUserResponse =
                    await fetch(
                        "/api/auth/me"
                    );

                if (
                    currentUserResponse.ok
                ) {
                    const currentUser =
                        await currentUserResponse.json();

                    if (
                        currentUser?.user?.$id
                    ) {
                        const member =
                            await getCurrentMember(
                                currentUser.user.$id
                            );

                        setCurrentMember(
                            member
                        );
                    }
                }

                const response =
                    await fetch(
                        `/api/notifications/members?databaseId=${encodeURIComponent(
                            DATABASE_ID
                        )}&tableId=${encodeURIComponent(
                            MEMBERS_TABLE_ID
                        )}`
                    );

                if (response.ok) {
                    const data =
                        await response.json();

                    setMembers(
                        data.members || []
                    );

                    return;
                }

                setMembers([]);
            } catch (error) {
                console.error(
                    "Members loading error:",
                    error
                );

                setMembers([]);
            } finally {
                setLoadingMembers(
                    false
                );
            }
        };

        loadMembers();
    }, []);

    /* ============================================================
       RECIPIENT COUNT
    ============================================================ */

    const recipientCount =
        useMemo(() => {
            if (
                audience ===
                "everyone"
            ) {
                return members.length;
            }

            return selectedUsers.length;
        }, [
            audience,
            members.length,
            selectedUsers.length,
        ]);

    /* ============================================================
       SELECT ALL
    ============================================================ */

    const handleSelectAll = () => {
        setSelectedUsers(
            members.map(
                (member) =>
                    member.$id
            )
        );
    };

    /* ============================================================
       CLEAR
    ============================================================ */

    const handleClear = () => {
        setSelectedUsers([]);
    };

    /* ============================================================
       INDIVIDUAL SELECTION
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
                            id !==
                            userId
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
       INITIALS
    ============================================================ */

    const getInitial = (
        name: string
    ) => {
        return (
            name
                ?.charAt(0)
                ?.toUpperCase() ||
            "U"
        );
    };

    /* ============================================================
       ROLE LABEL
    ============================================================ */

    const getRoleLabel = (
        role: string
    ) => {
        return (
            role
                .charAt(0)
                .toUpperCase() +
            role.slice(1)
        );
    };

    /* ============================================================
       PUBLISH ANNOUNCEMENT
    ============================================================ */

    const handlePublish = async () => {
        if (!title.trim()) {
            await Swal.fire({
                icon: "warning",
                title: "Title Required",
                text:
                    "Please enter an announcement title.",
                confirmButtonColor:
                    "#020617",
            });

            return;
        }

        if (!message.trim()) {
            await Swal.fire({
                icon: "warning",
                title: "Message Required",
                text:
                    "Please enter an announcement message.",
                confirmButtonColor:
                    "#020617",
            });

            return;
        }

        if (
            audience === "selected" &&
            selectedUsers.length === 0
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Select Recipients",
                text:
                    "Please select at least one user.",
                confirmButtonColor:
                    "#020617",
            });

            return;
        }

        if (recipientCount === 0) {
            await Swal.fire({
                icon: "warning",
                title: "No Recipients",
                text:
                    "There are no valid recipients for this announcement.",
                confirmButtonColor:
                    "#020617",
            });

            return;
        }

        const confirmation =
            await Swal.fire({
                icon: "question",
                title:
                    "Publish Announcement?",
                text:
                    `This announcement will be sent to ${recipientCount} user${
                        recipientCount ===
                        1
                            ? ""
                            : "s"
                    }.`,
                showCancelButton:
                    true,
                confirmButtonText:
                    "Publish",
                cancelButtonText:
                    "Cancel",
                confirmButtonColor:
                    "#020617",
                cancelButtonColor:
                    "#94a3b8",
            });

        if (
            !confirmation.isConfirmed
        ) {
            return;
        }

        try {
            setPublishing(true);

            const response =
                await fetch(
                    "/api/notifications/announcement",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify(
                            {
                                title:
                                    title.trim(),
                                message:
                                    message.trim(),
                                audience,
                                selectedUsers:
                                    audience ===
                                    "selected"
                                        ? selectedUsers
                                        : [],
                            }
                        ),
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {
                throw new Error(
                    data.message ||
                        "Unable to publish system announcement."
                );
            }

            await Swal.fire({
                icon: "success",
                title:
                    "Announcement Published",
                text:
                    `${data.createdCount} system announcement${
                        data.createdCount ===
                        1
                            ? ""
                            : "s"
                    } sent successfully.`,
                confirmButtonColor:
                    "#020617",
            });

            setTitle("");
            setMessage("");
            setAudience(
                "everyone"
            );
            setSelectedUsers([]);
        } catch (error) {
            console.error(
                "System announcement publish error:",
                error
            );

            await Swal.fire({
                icon: "error",
                title:
                    "Publication Failed",
                text:
                    error instanceof
                    Error
                        ? error.message
                        : "Unable to publish system announcement.",
                confirmButtonColor:
                    "#020617",
            });
        } finally {
            setPublishing(false);
        }
    };

    /* ============================================================
       UI
    ============================================================ */

    return (
        <main className="min-h-screen bg-[#f5f7f9] text-slate-950">

            {/* ====================================================
                HEADER
            ==================================================== */}

            <header className="border-b border-slate-200 bg-white">

                <div className="mx-auto flex min-h-[82px] max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-10">

                    <div className="flex items-center gap-3">

                        <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                            H
                        </div>

                        <div>

                            <h1 className="text-lg font-bold tracking-tight">
                                HomeMate
                            </h1>

                            <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-400">
                                Home Services Platform
                            </p>

                        </div>

                    </div>

                    <Link
                        href="/dashboard/notifications"
                        className="border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                    >
                        ← Notifications
                    </Link>

                </div>

            </header>

            {/* ====================================================
                PAGE CONTENT
            ==================================================== */}

            <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 lg:px-10">

                {/* =================================================
                    PAGE TITLE
                ================================================= */}

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
                                System Announcements
                            </h2>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                                Publish important HomeMate
                                announcements and platform-wide
                                updates to registered users.
                            </p>

                        </div>

                        <div className="inline-flex w-fit items-center gap-2 border border-slate-200 bg-white px-4 py-3">

                            <span className="h-2.5 w-2.5 rounded-full bg-slate-950" />

                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                SYSTEM
                            </span>

                        </div>

                    </div>

                </section>

                {/* =================================================
                    MAIN GRID
                ================================================= */}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

                    {/* =================================================
                        COMPOSE
                    ================================================= */}

                    <section className="border border-slate-200 bg-white">

                        <div className="border-b border-slate-100 px-6 py-6">

                            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                Create Announcement
                            </p>

                            <h3 className="mt-1 text-xl font-bold text-slate-950">
                                Compose System Announcement
                            </h3>

                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                Create a clear announcement for
                                HomeMate users.
                            </p>

                        </div>

                        <div className="space-y-7 px-6 py-7">

                            {/* =================================================
                                TITLE
                            ================================================= */}

                            <div>

                                <div className="mb-2 flex items-center justify-between gap-3">

                                    <label
                                        htmlFor="announcement-title"
                                        className="text-xs font-bold text-slate-900"
                                    >
                                        Announcement Title{" "}
                                        <span className="text-red-500">
                                            *
                                        </span>
                                    </label>

                                    <span className="text-[10px] text-slate-400">
                                        {title.length}/150
                                    </span>

                                </div>

                                <input
                                    id="announcement-title"
                                    type="text"
                                    value={title}
                                    maxLength={150}
                                    onChange={(
                                        event
                                    ) =>
                                        setTitle(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Example: Scheduled HomeMate Maintenance"
                                    className="h-14 w-full border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-slate-950"
                                />

                            </div>

                            {/* =================================================
                                MESSAGE
                            ================================================= */}

                            <div>

                                <div className="mb-2 flex items-center justify-between gap-3">

                                    <label
                                        htmlFor="announcement-message"
                                        className="text-xs font-bold text-slate-900"
                                    >
                                        Announcement Message{" "}
                                        <span className="text-red-500">
                                            *
                                        </span>
                                    </label>

                                    <span className="text-[10px] text-slate-400">
                                        {message.length}/1000
                                    </span>

                                </div>

                                <textarea
                                    id="announcement-message"
                                    value={message}
                                    maxLength={1000}
                                    onChange={(
                                        event
                                    ) =>
                                        setMessage(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    rows={8}
                                    placeholder="Write the important HomeMate announcement here..."
                                    className="w-full resize-none border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-slate-950"
                                />

                            </div>

                            {/* =================================================
                                AUDIENCE
                            ================================================= */}

                            <div>

                                <div className="mb-3">

                                    <p className="text-xs font-bold text-slate-900">
                                        Send To
                                    </p>

                                    <p className="mt-1 text-[11px] text-slate-400">
                                        Choose who should receive
                                        this announcement.
                                    </p>

                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                                    {/* EVERYONE */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAudience(
                                                "everyone"
                                            )
                                        }
                                        className={`border p-5 text-left transition ${
                                            audience ===
                                            "everyone"
                                                ? "border-slate-950 bg-slate-950 text-white"
                                                : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                                        }`}
                                    >

                                        <div className="flex items-start gap-4">

                                            <div
                                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${
                                                    audience ===
                                                    "everyone"
                                                        ? "border-white"
                                                        : "border-slate-300"
                                                }`}
                                            >

                                                {audience ===
                                                    "everyone" && (
                                                    <span className="h-2.5 w-2.5 bg-white" />
                                                )}

                                            </div>

                                            <div>

                                                <p className="text-sm font-bold">
                                                    All HomeMate Users
                                                </p>

                                                <p
                                                    className={`mt-1 text-[10px] leading-5 ${
                                                        audience ===
                                                        "everyone"
                                                            ? "text-slate-300"
                                                            : "text-slate-400"
                                                    }`}
                                                >
                                                    Send to every
                                                    registered member.
                                                </p>

                                            </div>

                                        </div>

                                    </button>

                                    {/* SELECTED USERS */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAudience(
                                                "selected"
                                            )
                                        }
                                        className={`border p-5 text-left transition ${
                                            audience ===
                                            "selected"
                                                ? "border-slate-950 bg-slate-950 text-white"
                                                : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
                                        }`}
                                    >

                                        <div className="flex items-start gap-4">

                                            <div
                                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${
                                                    audience ===
                                                    "selected"
                                                        ? "border-white"
                                                        : "border-slate-300"
                                                }`}
                                            >

                                                {audience ===
                                                    "selected" && (
                                                    <span className="h-2.5 w-2.5 bg-white" />
                                                )}

                                            </div>

                                            <div>

                                                <p className="text-sm font-bold">
                                                    Selected Users
                                                </p>

                                                <p
                                                    className={`mt-1 text-[10px] leading-5 ${
                                                        audience ===
                                                        "selected"
                                                            ? "text-slate-300"
                                                            : "text-slate-400"
                                                    }`}
                                                >
                                                    Choose specific
                                                    HomeMate users.
                                                </p>

                                            </div>

                                        </div>

                                    </button>

                                </div>

                            </div>

                            {/* =================================================
                                SELECT RECIPIENTS
                            ================================================= */}

                            {audience ===
                                "selected" && (
                                <div className="border border-slate-200">

                                    <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center">

                                        <div>

                                            <p className="text-xs font-bold text-slate-950">
                                                Select Recipients
                                            </p>

                                            <p className="mt-1 text-[10px] text-slate-400">
                                                {
                                                    selectedUsers.length
                                                }{" "}
                                                user(s) selected
                                            </p>

                                        </div>

                                        <div className="flex gap-2">

                                            <button
                                                type="button"
                                                onClick={
                                                    handleSelectAll
                                                }
                                                disabled={
                                                    loadingMembers ||
                                                    members.length ===
                                                        0
                                                }
                                                className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Select All
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    handleClear
                                                }
                                                disabled={
                                                    selectedUsers.length ===
                                                    0
                                                }
                                                className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Clear
                                            </button>

                                        </div>

                                    </div>

                                    <div className="max-h-[380px] overflow-y-auto">

                                        {loadingMembers ? (
                                            <div className="px-5 py-10 text-center">

                                                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />

                                                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    Loading users...
                                                </p>

                                            </div>
                                        ) : members.length ===
                                          0 ? (
                                            <div className="px-5 py-10 text-center">

                                                <p className="text-sm font-semibold text-slate-700">
                                                    No users available
                                                </p>

                                                <p className="mt-1 text-xs text-slate-400">
                                                    Recipient data will
                                                    appear here once the
                                                    members endpoint is
                                                    connected.
                                                </p>

                                            </div>
                                        ) : (
                                            members.map(
                                                (
                                                    recipient
                                                ) => {
                                                    const isSelected =
                                                        selectedUsers.includes(
                                                            recipient.$id
                                                        );

                                                    return (
                                                        <button
                                                            type="button"
                                                            key={
                                                                recipient.$id
                                                            }
                                                            onClick={() =>
                                                                toggleUser(
                                                                    recipient.$id
                                                                )
                                                            }
                                                            className={`flex w-full items-center gap-4 border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 ${
                                                                isSelected
                                                                    ? "bg-slate-50"
                                                                    : "bg-white hover:bg-slate-50"
                                                            }`}
                                                        >

                                                            <div
                                                                className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                                                                    isSelected
                                                                        ? "border-slate-950 bg-slate-950"
                                                                        : "border-slate-300 bg-white"
                                                                }`}
                                                            >

                                                                {isSelected && (
                                                                    <span className="text-[10px] font-bold text-white">
                                                                        ✓
                                                                    </span>
                                                                )}

                                                            </div>

                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                                                                {getInitial(
                                                                    recipient.fullName
                                                                )}
                                                            </div>

                                                            <div className="min-w-0 flex-1">

                                                                <p className="truncate text-xs font-bold text-slate-950">
                                                                    {
                                                                        recipient.fullName
                                                                    }
                                                                </p>

                                                                <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                                                    {getRoleLabel(
                                                                        recipient.role
                                                                    )}
                                                                </p>

                                                            </div>

                                                        </button>
                                                    );
                                                }
                                            )
                                        )}

                                    </div>

                                </div>
                            )}

                        </div>

                    </section>

                    {/* =================================================
                        RIGHT SIDE
                    ================================================= */}

                    <aside className="space-y-6">

                        {/* =================================================
                            PREVIEW
                        ================================================= */}

                        <div className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-5 py-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Preview
                                </p>

                                <h3 className="mt-1 text-base font-bold text-slate-950">
                                    Announcement Preview
                                </h3>

                            </div>

                            <div className="p-5">

                                <div className="border border-slate-200 bg-slate-50 p-4">

                                    <div className="flex items-start gap-4">

                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-slate-950 text-xl">
                                            📢
                                        </div>

                                        <div className="min-w-0">

                                            <div className="flex items-center gap-2">

                                                <p className="truncate text-sm font-bold text-slate-950">
                                                    {title ||
                                                        "Your announcement title"}
                                                </p>

                                            </div>

                                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                                {message ||
                                                    "Your system announcement message will appear here."}
                                            </p>

                                            <p className="mt-3 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                                SYSTEM ANNOUNCEMENT
                                            </p>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>

                        {/* =================================================
                            DELIVERY SUMMARY
                        ================================================= */}

                        <div className="border border-slate-200 bg-white">

                            <div className="border-b border-slate-100 px-5 py-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                    Recipients
                                </p>

                                <h3 className="mt-1 text-base font-bold text-slate-950">
                                    Delivery Summary
                                </h3>

                            </div>

                            <div className="px-5">

                                <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-4">

                                    <span className="text-xs text-slate-500">
                                        Audience
                                    </span>

                                    <span className="text-xs font-bold text-slate-950">
                                        {audience ===
                                        "everyone"
                                            ? "Everyone"
                                            : "Selected Users"}
                                    </span>

                                </div>

                                <div className="flex items-center justify-between gap-4 py-4">

                                    <span className="text-xs text-slate-500">
                                        Recipients
                                    </span>

                                    <span className="text-xs font-bold text-slate-950">
                                        {recipientCount}{" "}
                                        users
                                    </span>

                                </div>

                            </div>

                        </div>

                        {/* =================================================
                            INFORMATION
                        ================================================= */}

                        <div className="border border-slate-200 bg-blue-50 p-5">

                            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-500">
                                About System Announcements
                            </p>

                            <p className="mt-2 text-xs leading-5 text-slate-600">
                                Use system announcements for
                                important platform updates,
                                maintenance notices, service
                                changes and other information
                                relevant to HomeMate users.
                            </p>

                        </div>

                    </aside>

                </div>

                {/* ====================================================
                    PUBLISH SECTION
                ==================================================== */}

                <section className="mt-6 border border-slate-200 bg-white p-5 sm:p-6">

                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

                        <div>

                            <p className="text-xs font-bold text-slate-950">
                                Ready to publish?
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                                The announcement will be delivered
                                to the selected recipients.
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={
                                handlePublish
                            }
                            disabled={
                                publishing ||
                                !title.trim() ||
                                !message.trim() ||
                                recipientCount ===
                                    0
                            }
                            className="w-full bg-slate-950 px-8 py-4 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 md:w-auto"
                        >
                            {publishing
                                ? "Publishing..."
                                : "📢 Publish System Announcement"}
                        </button>

                    </div>

                </section>

                {/* ====================================================
                    BACK BUTTON
                ==================================================== */}

                <div className="mt-6">

                    <Link
                        href="/dashboard/notifications"
                        className="flex w-full items-center justify-center border border-slate-200 bg-white px-5 py-4 text-xs font-bold text-slate-600 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                    >
                        ← Back to Notifications
                    </Link>

                </div>

            </div>

        </main>
    );
}