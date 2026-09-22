"use client";

import { Suspense, useMemo } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    useRouter,
    useSearchParams,
} from "next/navigation";
import Swal from "sweetalert2";

import {
    getServiceById,
    updateService,
} from "@/lib/appwrite/service";

import {
    ServiceForm,
    useAdminEditServiceStore,
} from "@/lib/stores/admin-edit-service-store";

interface Service {
    $id: string;
    serviceName?: string | null;
    description?: string | null;
    duration?: number | null;
    price?: number | null;
    availableDays?: string | string[];
    availableSlots?: string | string[];
}

const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

const slots = [
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
    "06:00 PM",
    "07:00 PM",
    "08:00 PM",
];

const emptyForm: ServiceForm = {
    serviceName: "",
    description: "",
    duration: "",
    price: "",
    availableDays: [],
    availableSlots: [],
};

const parseArray = (
    value: string | string[] | undefined
): string[] => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        return [];
    } catch {
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
};

const serviceToForm = (
    service: Service
): ServiceForm => ({
    serviceName:
        service.serviceName || "",

    description:
        service.description || "",

    duration:
        String(
            service.duration ?? ""
        ),

    price:
        String(
            service.price ?? ""
        ),

    availableDays:
        parseArray(
            service.availableDays
        ),

    availableSlots:
        parseArray(
            service.availableSlots
        ),
});

function EditServicePageContent() {
    const router = useRouter();

    const searchParams =
        useSearchParams();

    const serviceId =
        searchParams.get("id");

    const queryClient =
        useQueryClient();

    const {
        draftForm,
        editingServiceId,
        setField,
        toggleDay: toggleDayInStore,
        toggleSlot: toggleSlotInStore,
        resetForm,
    } = useAdminEditServiceStore();

    /* ============================================================
       LOAD SERVICE
       TANSTACK QUERY
    ============================================================ */

    const serviceQuery = useQuery({
        queryKey: [
            "admin",
            "service",
            serviceId,
        ],

        queryFn: async () => {
            if (!serviceId) {
                await Swal.fire({
                    icon: "error",
                    title: "Service ID Missing",
                    text: "No service was selected.",
                    confirmButtonColor:
                        "#0f172a",
                });

                router.push(
                    "/dashboard/admin/services"
                );

                throw new Error(
                    "Service ID is missing"
                );
            }

            try {
                const service =
                    await getServiceById(
                        serviceId
                    );

                return service as Service;
            } catch (error) {
                console.error(
                    "Failed to load service:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Unable to Load Service",
                    text: "The selected service could not be loaded.",
                    confirmButtonColor:
                        "#0f172a",
                });

                router.push(
                    "/dashboard/admin/services"
                );

                throw error;
            }
        },

        enabled: true,

        retry: false,
    });

    const service =
        serviceQuery.data;

    /* ============================================================
       FORM
       TANSTACK QUERY = SERVER DATA
       ZUSTAND = EDITABLE CLIENT DATA
    ============================================================ */

    const form = useMemo(() => {
        if (
            serviceId &&
            editingServiceId === serviceId &&
            draftForm
        ) {
            return draftForm;
        }

        if (service) {
            return serviceToForm(
                service
            );
        }

        return emptyForm;
    }, [
        service,
        serviceId,
        editingServiceId,
        draftForm,
    ]);

    /* ============================================================
       UPDATE SERVICE
       TANSTACK MUTATION
    ============================================================ */

    const updateMutation =
        useMutation({
            mutationFn: async (
                data: ServiceForm
            ) => {
                if (!serviceId) {
                    throw new Error(
                        "Service ID is missing"
                    );
                }

                await updateService(
                    serviceId,
                    {
                        serviceName:
                            data.serviceName.trim(),

                        description:
                            data.description.trim() ||
                            null,

                        duration:
                            Number(
                                data.duration
                            ),

                        price:
                            Number(
                                data.price
                            ),

                        availableDays:
                            data.availableDays,

                        availableSlots:
                            data.availableSlots,
                    }
                );
            },

            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: [
                        "admin",
                        "services",
                    ],
                });

                if (serviceId) {
                    await queryClient.invalidateQueries({
                        queryKey: [
                            "admin",
                            "service",
                            serviceId,
                        ],
                    });
                }
            },
        });

    const saving =
        updateMutation.isPending;

    /* ============================================================
       FORM CHANGE
    ============================================================ */

    const handleChange = (
        field: keyof ServiceForm,
        value: string
    ) => {
        setField(
            serviceId,
            form,
            field,
            value
        );
    };

    /* ============================================================
       TOGGLE DAY
    ============================================================ */

    const toggleDay = (
        day: string
    ) => {
        toggleDayInStore(
            serviceId,
            form,
            day
        );
    };

    /* ============================================================
       TOGGLE SLOT
    ============================================================ */

    const toggleSlot = (
        slot: string
    ) => {
        toggleSlotInStore(
            serviceId,
            form,
            slot
        );
    };

    /* ============================================================
       SUBMIT
    ============================================================ */

    const handleSubmit = async (
        event: {
            preventDefault: () => void;
        }
    ) => {
        event.preventDefault();

        if (!serviceId) {
            return;
        }

        /* SERVICE NAME */

        if (!form.serviceName.trim()) {
            Swal.fire({
                icon: "warning",
                title: "Service Name Required",
                text: "Please enter a service name.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }

        /* DURATION */

        if (
            !form.duration ||
            Number(form.duration) <= 0
        ) {
            Swal.fire({
                icon: "warning",
                title: "Invalid Duration",
                text: "Please enter a valid service duration.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }

        /* PRICE */

        if (
            !form.price ||
            Number(form.price) < 0
        ) {
            Swal.fire({
                icon: "warning",
                title: "Invalid Price",
                text: "Please enter a valid service price.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }

        /* DAYS */

        if (
            form.availableDays.length === 0
        ) {
            Swal.fire({
                icon: "warning",
                title: "Select Available Days",
                text: "Please select at least one available day.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }

        /* SLOTS */

        if (
            form.availableSlots.length === 0
        ) {
            Swal.fire({
                icon: "warning",
                title: "Select Available Slots",
                text: "Please select at least one available slot.",
                confirmButtonColor:
                    "#0f172a",
            });

            return;
        }

        try {
            await updateMutation.mutateAsync(
                form
            );

            await Swal.fire({
                icon: "success",
                title: "Service Updated",
                text: "The service has been updated successfully.",
                confirmButtonColor:
                    "#0f172a",
            });

            resetForm();

            router.push(
                "/dashboard/admin/services"
            );
        } catch (error) {
            console.error(
                "Update service error:",
                error
            );

            Swal.fire({
                icon: "error",
                title: "Update Failed",
                text: "Unable to update the service. Please try again.",
                confirmButtonColor:
                    "#0f172a",
            });
        }
    };

    /* ============================================================
       LOADING
    ============================================================ */

    if (
        serviceQuery.isLoading ||
        serviceQuery.isFetching
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-100">

                <div className="text-center">

                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

                    <p className="text-sm text-slate-500">
                        Loading service...
                    </p>

                </div>

            </main>
        );
    }

    /* ============================================================
       PAGE
    ============================================================ */

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-6 lg:px-8">

            <div className="mx-auto max-w-5xl">

                {/* HEADER */}

                <div className="mb-6">

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/admin/services"
                            )
                        }
                        className="mb-3 text-sm font-medium text-slate-500 transition hover:text-slate-900"
                    >
                        ← Back to Services
                    </button>

                    <h1 className="text-3xl font-bold text-slate-900">
                        Edit Service
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Update the selected service
                        information.
                    </p>

                </div>

                {/* FORM */}

                <form
                    onSubmit={handleSubmit}
                    className="border border-slate-200 bg-white shadow-sm"
                >

                    {/* BASIC INFORMATION */}

                    <div className="border-b border-slate-200 p-6">

                        <h2 className="text-lg font-bold text-slate-900">
                            Basic Information
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Update the service name and
                            description.
                        </p>

                        <div className="mt-5 grid grid-cols-1 gap-5">

                            <div>

                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Service Name
                                </label>

                                <input
                                    type="text"
                                    value={
                                        form.serviceName
                                    }
                                    onChange={(event) =>
                                        handleChange(
                                            "serviceName",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Enter service name"
                                    className="w-full border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                                />

                            </div>

                            <div>

                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Description
                                </label>

                                <textarea
                                    value={
                                        form.description
                                    }
                                    onChange={(event) =>
                                        handleChange(
                                            "description",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Enter service description"
                                    rows={5}
                                    className="w-full resize-none border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                                />

                            </div>

                        </div>

                    </div>

                    {/* PRICE & DURATION */}

                    <div className="border-b border-slate-200 p-6">

                        <h2 className="text-lg font-bold text-slate-900">
                            Pricing & Duration
                        </h2>

                        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">

                            <div>

                                <label className="mb-2 block text-sm font-semibold text-slate-700">

                                    Duration

                                    <span className="ml-1 text-xs font-normal text-slate-400">
                                        (minutes)
                                    </span>

                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    value={
                                        form.duration
                                    }
                                    onChange={(event) =>
                                        handleChange(
                                            "duration",
                                            event.target.value
                                        )
                                    }
                                    placeholder="e.g. 60"
                                    className="w-full border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                                />

                            </div>

                            <div>

                                <label className="mb-2 block text-sm font-semibold text-slate-700">

                                    Price

                                    <span className="ml-1 text-xs font-normal text-slate-400">
                                        (₹)
                                    </span>

                                </label>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                        form.price
                                    }
                                    onChange={(event) =>
                                        handleChange(
                                            "price",
                                            event.target.value
                                        )
                                    }
                                    placeholder="e.g. 999"
                                    className="w-full border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                                />

                            </div>

                        </div>

                    </div>

                    {/* AVAILABLE DAYS */}

                    <div className="border-b border-slate-200 p-6">

                        <h2 className="text-lg font-bold text-slate-900">
                            Available Days
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Select the days on which this
                            service is available.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-3">

                            {days.map(
                                (day) => {

                                    const selected =
                                        form.availableDays.includes(
                                            day
                                        );

                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() =>
                                                toggleDay(
                                                    day
                                                )
                                            }
                                            className={`border px-4 py-2 text-sm font-semibold transition ${
                                                selected
                                                    ? "border-slate-900 bg-slate-900 text-white"
                                                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-900"
                                            }`}
                                        >
                                            {day}
                                        </button>
                                    );
                                }
                            )}

                        </div>

                    </div>

                    {/* AVAILABLE SLOTS */}

                    <div className="border-b border-slate-200 p-6">

                        <h2 className="text-lg font-bold text-slate-900">
                            Available Time Slots
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Select the time slots available
                            for bookings.
                        </p>

                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">

                            {slots.map(
                                (slot) => {

                                    const selected =
                                        form.availableSlots.includes(
                                            slot
                                        );

                                    return (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() =>
                                                toggleSlot(
                                                    slot
                                                )
                                            }
                                            className={`border px-3 py-2 text-sm font-semibold transition ${
                                                selected
                                                    ? "border-slate-900 bg-slate-900 text-white"
                                                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-900"
                                            }`}
                                        >
                                            {slot}
                                        </button>
                                    );
                                }
                            )}

                        </div>

                    </div>

                    {/* ACTIONS */}

                    <div className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-end">

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/dashboard/admin/services"
                                )
                            }
                            className="border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving
                                ? "Saving Changes..."
                                : "Save Changes"}
                        </button>

                    </div>

                </form>

                <div className="mt-6 text-center text-xs text-slate-400">
                    HomeMate Super Admin Portal •
                    Service Management
                </div>

            </div>

        </main>
    );
}

export default function EditServicePage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen items-center justify-center bg-slate-100">
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
                        <p className="text-sm text-slate-500">
                            Loading service...
                        </p>
                    </div>
                </main>
            }
        >
            <EditServicePageContent />
        </Suspense>
    );
}
