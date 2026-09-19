"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Swal from "sweetalert2";
import type { Models } from "appwrite";

import { getCurrentUser } from "@/lib/appwrite/account";
import { createBooking } from "@/lib/appwrite/booking";
import { getUserProperties } from "@/lib/appwrite/property";
import { getAllServices } from "@/lib/appwrite/service";

import { useBookingStore } from "@/lib/stores/booking-store";

interface Property extends Models.Document {
    propertyName?: string;
    address?: string;
    city?: string;
}

interface Service extends Models.Document {
    userId: string;
    serviceName: string;
    description?: string;
    duration: number;
    price: number;
    availableDays: string;
    availableSlots: string;
}

export default function NewBookingPage() {
    const router = useRouter();

    /*
     * Zustand
     * ----------
     * Booking form state is kept in Zustand so that the
     * selected booking information is available outside
     * this component when required.
     */
    const {
        selectedService,
        selectedProperty,
        bookingDate,
        bookingTime,
        notes,

        setSelectedService,
        setSelectedProperty,
        setBookingDate,
        setBookingTime,
        setNotes,

        resetBooking,
    } = useBookingStore();

    /*
     * TanStack Query
     * ----------
     * Load the currently logged-in user's properties.
     */
    const {
        data: properties = [],
        isLoading: propertiesLoading,
    } = useQuery({
        queryKey: ["booking-properties"],
        queryFn: async (): Promise<Property[]> => {
            const user = await getCurrentUser();

            const response =
                await getUserProperties(user.$id);

            return response.documents as Property[];
        },
    });

    /*
     * TanStack Query
     * ----------
     * Load all available professional services.
     */
    const {
        data: services = [],
        isLoading: servicesLoading,
    } = useQuery({
        queryKey: ["booking-services"],
        queryFn: async (): Promise<Service[]> => {
            const response = await getAllServices();

            return response.documents as unknown as Service[];
        },
    });

    /*
     * Overall loading state
     */
    const loading =
        propertiesLoading || servicesLoading;

    /*
     * Find the currently selected service.
     */
    const selectedServiceData = useMemo(
        () =>
            services.find(
                (service) =>
                    service.$id === selectedService
            ),
        [services, selectedService]
    );

    /*
     * Find the currently selected property.
     */
    const selectedPropertyData = useMemo(
        () =>
            properties.find(
                (property) =>
                    property.$id === selectedProperty
            ),
        [properties, selectedProperty]
    );

    /*
     * Parse service available days.
     */
    const getAvailableDays = (
        service: Service
    ): string[] => {
        try {
            const days = JSON.parse(
                service.availableDays
            );

            return Array.isArray(days)
                ? days
                : [];
        } catch {
            return [];
        }
    };

    /*
     * Parse service available slots.
     */
    const getAvailableSlots = (
        service: Service
    ): string[] => {
        try {
            const slots = JSON.parse(
                service.availableSlots
            );

            return Array.isArray(slots)
                ? slots
                : [];
        } catch {
            return [];
        }
    };

    /*
     * When service changes:
     * - update Zustand
     * - clear previously selected date/time
     */
    const handleServiceChange = (
        value: string
    ) => {
        setSelectedService(value);
        setBookingTime("");
        setBookingDate("");
    };

    /*
     * Check whether the selected date is available
     * according to the selected service.
     */
    const isDateAvailable = (
        dateValue: string
    ) => {
        if (
            !dateValue ||
            !selectedServiceData
        ) {
            return false;
        }

        const date = new Date(
            `${dateValue}T00:00:00`
        );

        const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ];

        const selectedDay =
            dayNames[date.getDay()];

        return getAvailableDays(
            selectedServiceData
        ).includes(selectedDay);
    };

    /*
     * TanStack Query mutation
     * ----------
     * Handles booking creation.
     */
    const createBookingMutation =
        useMutation({
            mutationFn: async () => {
                const user =
                    await getCurrentUser();

                if (!selectedServiceData) {
                    throw new Error(
                        "Selected service not found."
                    );
                }

                /*
                 * Create the booking first.
                 */
                const createdBooking =
                    await createBooking({
                        customerId: user.$id,

                        professionalId:
                            selectedServiceData.userId,

                        serviceId:
                            selectedServiceData.$id,

                        propertyId:
                            selectedProperty,

                        bookingDate:
                            `${bookingDate}T00:00:00.000Z`,

                        bookingTime,

                        notes:
                            notes.trim() || null,
                    });

                /*
                 * Create booking notification.
                 *
                 * The API route uses the Appwrite
                 * server SDK so that the notification
                 * can safely be assigned to the
                 * professional.
                 */
                try {
                    const notificationResponse =
                        await fetch(
                            "/api/notifications/booking",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },

                                body: JSON.stringify({
                                    customerId:
                                        user.$id,

                                    professionalId:
                                        selectedServiceData.userId,

                                    customerName:
                                        user.name ||
                                        "Customer",

                                    serviceName:
                                        selectedServiceData.serviceName,

                                    bookingDate,

                                    bookingTime,

                                    bookingId:
                                        createdBooking.$id,
                                }),
                            }
                        );

                    if (
                        !notificationResponse.ok
                    ) {
                        console.error(
                            "Booking was created, but notifications could not be created."
                        );
                    }
                } catch (
                    notificationError
                ) {
                    /*
                     * Notification failure should not
                     * make an already-created booking
                     * appear as failed.
                     */
                    console.error(
                        "Booking notification request failed:",
                        notificationError
                    );
                }

                return createdBooking;
            },

            onSuccess: async () => {
                await Swal.fire({
                    icon: "success",
                    title: "Booking Requested",
                    text: "Your service booking has been submitted successfully.",
                    confirmButtonText:
                        "View Bookings",
                });

                /*
                 * Clear Zustand booking state after
                 * successful booking.
                 */
                resetBooking();

                router.push(
                    "/dashboard/bookings"
                );
            },

            onError: async (error) => {
                console.error(
                    "Booking creation failed:",
                    error
                );

                await Swal.fire({
                    icon: "error",
                    title: "Booking Failed",
                    text: "Unable to create the booking. Please try again.",
                });
            },
        });

    /*
     * Submit booking
     */
    const handleSubmit = async () => {
        if (!selectedService) {
            await Swal.fire({
                icon: "warning",
                title: "Select Service",
                text: "Please select a service.",
            });

            return;
        }

        if (!selectedProperty) {
            await Swal.fire({
                icon: "warning",
                title: "Select Property",
                text: "Please select a property.",
            });

            return;
        }

        if (!bookingDate) {
            await Swal.fire({
                icon: "warning",
                title: "Select Date",
                text: "Please select a booking date.",
            });

            return;
        }

        if (
            !isDateAvailable(
                bookingDate
            )
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Unavailable Date",
                text: "This service is not available on the selected day.",
            });

            return;
        }

        if (!bookingTime) {
            await Swal.fire({
                icon: "warning",
                title: "Select Time",
                text: "Please select an available time slot.",
            });

            return;
        }

        createBookingMutation.mutate();
    };

    /*
     * Loading screen
     */
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-500">
                    Loading booking form...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="mb-8">
                    <button
                        type="button"
                        onClick={() =>
                            router.back()
                        }
                        className="text-sm text-slate-600 hover:text-slate-900 mb-4"
                    >
                        ← Back
                    </button>

                    <h1 className="text-3xl font-bold text-slate-900">
                        Book a Service
                    </h1>

                    <p className="text-slate-500 mt-2">
                        Select a professional service,
                        property and preferred time.
                    </p>
                </div>

                {/* Form */}
                <div className="bg-white border border-slate-200 shadow-sm p-6 md:p-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Service */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Select Service
                            </label>

                            <select
                                value={
                                    selectedService
                                }
                                onChange={(e) =>
                                    handleServiceChange(
                                        e.target.value
                                    )
                                }
                                className="w-full border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                            >
                                <option value="">
                                    Select a service
                                </option>

                                {services.map(
                                    (service) => (
                                        <option
                                            key={
                                                service.$id
                                            }
                                            value={
                                                service.$id
                                            }
                                        >
                                            {
                                                service.serviceName
                                            }{" "}
                                            — ₹
                                            {
                                                service.price
                                            }
                                        </option>
                                    )
                                )}
                            </select>

                            {services.length ===
                                0 && (
                                    <p className="text-sm text-slate-500 mt-2">
                                        No professional
                                        services are
                                        currently available.
                                    </p>
                                )}
                        </div>

                        {/* Service Details */}
                        {selectedServiceData && (
                            <div className="md:col-span-2 bg-slate-50 border border-slate-200 p-5">

                                <h2 className="font-semibold text-slate-900 text-lg">
                                    {
                                        selectedServiceData.serviceName
                                    }
                                </h2>

                                {selectedServiceData.description && (
                                    <p className="text-sm text-slate-600 mt-2">
                                        {
                                            selectedServiceData.description
                                        }
                                    </p>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">

                                    <div>
                                        <p className="text-xs text-slate-500">
                                            Price
                                        </p>

                                        <p className="font-semibold text-slate-900 mt-1">
                                            ₹
                                            {
                                                selectedServiceData.price
                                            }
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500">
                                            Duration
                                        </p>

                                        <p className="font-semibold text-slate-900 mt-1">
                                            {
                                                selectedServiceData.duration
                                            }{" "}
                                            mins
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500">
                                            Available Days
                                        </p>

                                        <p className="font-semibold text-slate-900 mt-1">
                                            {getAvailableDays(
                                                selectedServiceData
                                            ).join(
                                                ", "
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500">
                                            Available Slots
                                        </p>

                                        <p className="font-semibold text-slate-900 mt-1">
                                            {getAvailableSlots(
                                                selectedServiceData
                                            ).join(
                                                ", "
                                            )}
                                        </p>
                                    </div>

                                </div>
                            </div>
                        )}

                        {/* Property */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Select Property
                            </label>

                            <select
                                value={
                                    selectedProperty
                                }
                                onChange={(e) =>
                                    setSelectedProperty(
                                        e.target.value
                                    )
                                }
                                className="w-full border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                            >
                                <option value="">
                                    Select your property
                                </option>

                                {properties.map(
                                    (property) => (
                                        <option
                                            key={
                                                property.$id
                                            }
                                            value={
                                                property.$id
                                            }
                                        >
                                            {
                                                property.propertyName
                                            }
                                        </option>
                                    )
                                )}
                            </select>

                            {properties.length ===
                                0 && (
                                    <p className="text-sm text-red-500 mt-2">
                                        Please add a property
                                        before creating a
                                        booking.
                                    </p>
                                )}
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Booking Date
                            </label>

                            <input
                                type="date"
                                value={
                                    bookingDate
                                }
                                min={
                                    new Date()
                                        .toISOString()
                                        .split(
                                            "T"
                                        )[0]
                                }
                                onChange={(e) =>
                                    setBookingDate(
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !selectedService
                                }
                                className="w-full border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                            />

                            {!selectedService && (
                                <p className="text-xs text-slate-500 mt-2">
                                    Select a service
                                    first.
                                </p>
                            )}

                            {bookingDate &&
                                selectedServiceData &&
                                !isDateAvailable(
                                    bookingDate
                                ) && (
                                    <p className="text-sm text-red-600 mt-2">
                                        This service is
                                        unavailable on
                                        the selected day.
                                    </p>
                                )}
                        </div>

                        {/* Time */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Available Time
                            </label>

                            <select
                                value={
                                    bookingTime
                                }
                                onChange={(e) =>
                                    setBookingTime(
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !selectedService ||
                                    !bookingDate ||
                                    !isDateAvailable(
                                        bookingDate
                                    )
                                }
                                className="w-full border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100"
                            >
                                <option value="">
                                    Select time
                                </option>

                                {selectedServiceData &&
                                    getAvailableSlots(
                                        selectedServiceData
                                    ).map(
                                        (slot) => (
                                            <option
                                                key={
                                                    slot
                                                }
                                                value={
                                                    slot
                                                }
                                            >
                                                {slot}
                                            </option>
                                        )
                                    )}
                            </select>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Notes
                            </label>

                            <textarea
                                value={notes}
                                onChange={(e) =>
                                    setNotes(
                                        e.target.value
                                    )
                                }
                                rows={4}
                                placeholder="Describe any specific requirements..."
                                className="w-full border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 resize-none"
                            />
                        </div>

                    </div>

                    {/* Booking Summary */}
                    <div className="mt-8 border-t border-slate-200 pt-6">

                        <h2 className="text-lg font-semibold text-slate-900 mb-4">
                            Booking Summary
                        </h2>

                        <div className="bg-slate-50 border border-slate-200 p-5 space-y-3">

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                    Service
                                </span>

                                <span className="font-medium text-slate-900 text-right">
                                    {selectedServiceData
                                        ? selectedServiceData.serviceName
                                        : "Not selected"}
                                </span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                    Property
                                </span>

                                <span className="font-medium text-slate-900 text-right">
                                    {selectedPropertyData
                                        ? selectedPropertyData.propertyName
                                        : "Not selected"}
                                </span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                    Date
                                </span>

                                <span className="font-medium text-slate-900">
                                    {bookingDate ||
                                        "Not selected"}
                                </span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">
                                    Time
                                </span>

                                <span className="font-medium text-slate-900">
                                    {bookingTime ||
                                        "Not selected"}
                                </span>
                            </div>

                            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                                <span className="font-semibold text-slate-700">
                                    Estimated Price
                                </span>

                                <span className="font-bold text-slate-900">
                                    ₹
                                    {selectedServiceData
                                        ? selectedServiceData.price
                                        : 0}
                                </span>
                            </div>

                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-8">

                        <button
                            type="button"
                            onClick={() =>
                                router.back()
                            }
                            className="flex-1 border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={
                                createBookingMutation.isPending
                            }
                            className="flex-1 bg-slate-900 text-white px-6 py-3 font-semibold hover:bg-slate-800 disabled:opacity-50"
                        >
                            {createBookingMutation.isPending
                                ? "Submitting..."
                                : "Confirm Booking"}
                        </button>

                    </div>

                </div>
            </div>
        </div>
    );
}