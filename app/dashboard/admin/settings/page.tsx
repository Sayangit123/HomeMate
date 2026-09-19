"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import Swal from "sweetalert2";

import {
    getPlatformSettings,
    updatePlatformSettings,
} from "@/lib/appwrite/platform-settings";

import {
    useAdminSettingsStore,
} from "@/lib/stores/admin-settings-store";

export default function PlatformSettingsPage() {
    const queryClient = useQueryClient();

    const settings =
        useAdminSettingsStore(
            (state) => state.settings
        );

    const setSettings =
        useAdminSettingsStore(
            (state) => state.setSettings
        );

    const updateLocalField =
        useAdminSettingsStore(
            (state) => state.updateLocalField
        );

    const settingsQuery = useQuery({
        queryKey: ["admin-platform-settings"],
        queryFn: getPlatformSettings,
    });

    useEffect(() => {
        if (settingsQuery.data) {
            setSettings(settingsQuery.data);
        }
    }, [
        settingsQuery.data,
        setSettings,
    ]);

    const updateMutation =
        useMutation({
            mutationFn: async () => {
                if (!settings) {
                    throw new Error(
                        "Platform settings are not available."
                    );
                }

                return await updatePlatformSettings(
                    settings.$id,
                    {
                        platformName:
                            settings.platformName ?? "",

                        platformEmail:
                            settings.platformEmail ?? "",

                        platformPhone:
                            settings.platformPhone ?? "",

                        maintenanceMode:
                            settings.maintenanceMode ??
                            false,

                        allowRegistrations:
                            settings.allowRegistrations ??
                            true,

                        allowBookings:
                            settings.allowBookings ??
                            true,

                        commissionRate:
                            Number(
                                settings.commissionRate ??
                                    0
                            ),

                        supportMessage:
                            settings.supportMessage ?? "",
                    }
                );
            },

            onSuccess: async (
                updatedSettings
            ) => {
                setSettings(
                    updatedSettings
                );

                await queryClient.invalidateQueries({
                    queryKey: [
                        "admin-platform-settings",
                    ],
                });

                await Swal.fire({
                    icon: "success",
                    title: "Settings Updated",
                    text: "Platform settings have been updated successfully.",
                    confirmButtonColor:
                        "#0f172a",
                });
            },

            onError: (error) => {
                console.error(
                    "Settings update error:",
                    error
                );

                Swal.fire({
                    icon: "error",
                    title: "Update Failed",
                    text:
                        error instanceof Error
                            ? error.message
                            : "Unable to update platform settings.",
                    confirmButtonColor:
                        "#0f172a",
                });
            },
        });

    if (
        settingsQuery.isLoading ||
        !settings
    ) {
        return (
            <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8">
                        <div className="h-4 w-32 animate-pulse bg-slate-300" />

                        <div className="mt-3 h-9 w-72 animate-pulse bg-slate-300" />

                        <div className="mt-3 h-4 w-96 max-w-full animate-pulse bg-slate-300" />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="h-80 animate-pulse bg-white shadow-sm" />
                        <div className="h-80 animate-pulse bg-white shadow-sm" />
                        <div className="h-72 animate-pulse bg-white shadow-sm" />
                        <div className="h-72 animate-pulse bg-white shadow-sm" />
                    </div>
                </div>
            </main>
        );
    }

    if (settingsQuery.isError) {
        return (
            <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl">
                    <Link
                        href="/dashboard/admin"
                        className="inline-flex items-center text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                    >
                        ← Back to Admin Dashboard
                    </Link>

                    <div className="mt-8 border border-red-200 bg-white p-8 shadow-sm">
                        <div className="text-4xl">
                            ⚠️
                        </div>

                        <h1 className="mt-4 text-2xl font-bold text-slate-900">
                            Unable to Load Settings
                        </h1>

                        <p className="mt-2 max-w-xl text-sm text-slate-600">
                            We could not retrieve the
                            platform settings from Appwrite.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                settingsQuery.refetch()
                            }
                            className="mt-6 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    /*
     * Safe values
     *
     * These make sure every form control
     * remains controlled for its entire
     * lifetime.
     */
    const platformName =
        settings.platformName ?? "";

    const platformEmail =
        settings.platformEmail ?? "";

    const platformPhone =
        settings.platformPhone ?? "";

    const supportMessage =
        settings.supportMessage ?? "";

    const maintenanceMode =
        settings.maintenanceMode ?? false;

    const allowRegistrations =
        settings.allowRegistrations ?? true;

    const allowBookings =
        settings.allowBookings ?? true;

    const commissionRate =
        settings.commissionRate ?? 0;

    return (
        <main className="min-h-screen bg-slate-100">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <Link
                                href="/dashboard/admin"
                                className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                            >
                                ← Back to Admin Dashboard
                            </Link>

                            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                                Platform Settings
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                                Manage HomeMate platform
                                configuration, registration,
                                booking and support settings.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div
                                className={`flex items-center gap-2 border px-4 py-2 text-sm font-semibold ${
                                    maintenanceMode
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }`}
                            >
                                <span
                                    className={`h-2.5 w-2.5 ${
                                        maintenanceMode
                                            ? "bg-amber-500"
                                            : "bg-emerald-500"
                                    }`}
                                />

                                {maintenanceMode
                                    ? "Maintenance Mode"
                                    : "Platform Online"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Platform Information */}
                    <section className="border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center bg-slate-900 text-lg text-white">
                                    ⚙
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-950">
                                        Platform Information
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Basic information about
                                        HomeMate.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Platform Name
                                </label>

                                <input
                                    type="text"
                                    value={platformName}
                                    onChange={(event) =>
                                        updateLocalField(
                                            "platformName",
                                            event.target.value
                                        )
                                    }
                                    className="w-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                                    placeholder="HomeMate"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Platform Email
                                </label>

                                <input
                                    type="email"
                                    value={platformEmail}
                                    onChange={(event) =>
                                        updateLocalField(
                                            "platformEmail",
                                            event.target.value
                                        )
                                    }
                                    className="w-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                                    placeholder="admin@example.com"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Platform Phone
                                </label>

                                <input
                                    type="text"
                                    value={platformPhone}
                                    onChange={(event) =>
                                        updateLocalField(
                                            "platformPhone",
                                            event.target.value
                                        )
                                    }
                                    className="w-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                                    placeholder="+91 XXXXX XXXXX"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Platform Controls */}
                    <section className="border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center bg-slate-900 text-lg text-white">
                                    🛡
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-950">
                                        Platform Controls
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Control important platform
                                        features.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="divide-y divide-slate-200">
                            <SettingToggle
                                title="Maintenance Mode"
                                description="Temporarily place the platform into maintenance mode."
                                checked={maintenanceMode}
                                onChange={(value) =>
                                    updateLocalField(
                                        "maintenanceMode",
                                        value
                                    )
                                }
                            />

                            <SettingToggle
                                title="Allow Registrations"
                                description="Allow new customers, professionals and businesses to register."
                                checked={allowRegistrations}
                                onChange={(value) =>
                                    updateLocalField(
                                        "allowRegistrations",
                                        value
                                    )
                                }
                            />

                            <SettingToggle
                                title="Allow Bookings"
                                description="Allow customers to create new service bookings."
                                checked={allowBookings}
                                onChange={(value) =>
                                    updateLocalField(
                                        "allowBookings",
                                        value
                                    )
                                }
                            />
                        </div>
                    </section>

                    {/* Commission */}
                    <section className="border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center bg-slate-900 text-lg text-white">
                                    %
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-950">
                                        Commission Settings
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Configure the platform
                                        commission rate.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Commission Rate
                            </label>

                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={commissionRate}
                                    onChange={(event) => {
                                        const value =
                                            Number(
                                                event.target.value
                                            );

                                        updateLocalField(
                                            "commissionRate",
                                            value
                                        );
                                    }}
                                    className="w-full border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                                />

                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">
                                    %
                                </span>
                            </div>

                            <div className="mt-4 border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm text-slate-600">
                                    Current platform commission:
                                </p>

                                <p className="mt-1 text-2xl font-bold text-slate-950">
                                    {commissionRate}%
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Support */}
                    <section className="border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center bg-slate-900 text-lg text-white">
                                    ?
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-950">
                                        Support Information
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        Configure the platform
                                        support message.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Support Message
                            </label>

                            <textarea
                                rows={6}
                                maxLength={500}
                                value={supportMessage}
                                onChange={(event) =>
                                    updateLocalField(
                                        "supportMessage",
                                        event.target.value
                                    )
                                }
                                className="w-full resize-none border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                                placeholder="Enter a support message for HomeMate users..."
                            />

                            <div className="mt-2 flex justify-end text-xs text-slate-400">
                                {supportMessage.length}/500
                            </div>
                        </div>
                    </section>
                </div>

                {/* Save Area */}
                <section className="mt-6 border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-bold text-slate-950">
                                Save Platform Configuration
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Changes will be saved to the
                                HomeMate platform settings.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (
                                        settingsQuery.data
                                    ) {
                                        setSettings(
                                            settingsQuery.data
                                        );
                                    }
                                }}
                                disabled={
                                    updateMutation.isPending
                                }
                                className="border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Discard Changes
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    updateMutation.mutate()
                                }
                                disabled={
                                    updateMutation.isPending
                                }
                                className="bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {updateMutation.isPending
                                    ? "Saving..."
                                    : "Save Settings"}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Information */}
                <div className="mt-6 border border-blue-200 bg-blue-50 p-5">
                    <div className="flex gap-3">
                        <div className="text-xl">
                            ℹ
                        </div>

                        <div>
                            <h3 className="font-semibold text-blue-900">
                                Super Admin Configuration
                            </h3>

                            <p className="mt-1 text-sm leading-6 text-blue-800">
                                These settings are stored in
                                Appwrite and can be updated
                                from the Super Admin Portal.
                                Changes to maintenance,
                                registration and booking
                                controls should be made
                                carefully because they affect
                                platform behavior.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

interface SettingToggleProps {
    title: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}

function SettingToggle({
    title,
    description,
    checked,
    onChange,
}: SettingToggleProps) {
    return (
        <div className="flex items-center justify-between gap-6 p-6">
            <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">
                    {title}
                </h3>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                    {description}
                </p>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() =>
                    onChange(!checked)
                }
                className={`relative h-7 w-12 shrink-0 transition ${
                    checked
                        ? "bg-slate-900"
                        : "bg-slate-300"
                }`}
            >
                <span
                    className={`absolute top-1 h-5 w-5 bg-white shadow-sm transition ${
                        checked
                            ? "left-6"
                            : "left-1"
                    }`}
                />
            </button>
        </div>
    );
}