"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { getCurrentUser } from "@/lib/appwrite/account";
import {
    createService,
    type CreateServiceData,
} from "@/lib/appwrite/service";

const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

const TIME_SLOTS = [
    "08:00 AM",
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

export default function AddServicePage() {
    const router = useRouter();

    const [serviceName, setServiceName] = useState("");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState("");
    const [price, setPrice] = useState("");

    const [availableDays, setAvailableDays] = useState<string[]>(
        []
    );

    const [availableSlots, setAvailableSlots] = useState<string[]>(
        []
    );

    const [loading, setLoading] = useState(false);

    /* ============================================================
       TOGGLE DAY
    ============================================================ */

    const toggleDay = (day: string) => {
        setAvailableDays((currentDays) =>
            currentDays.includes(day)
                ? currentDays.filter(
                    (currentDay) => currentDay !== day
                )
                : [...currentDays, day]
        );
    };

    /* ============================================================
       TOGGLE TIME SLOT
    ============================================================ */

    const toggleSlot = (slot: string) => {
        setAvailableSlots((currentSlots) =>
            currentSlots.includes(slot)
                ? currentSlots.filter(
                    (currentSlot) => currentSlot !== slot
                )
                : [...currentSlots, slot]
        );
    };

    /* ============================================================
       CREATE SERVICE
    ============================================================ */

    const handleSubmit = async () => {
        if (!serviceName.trim()) {
            await Swal.fire({
                icon: "warning",
                title: "Service Name Required",
                text: "Please enter your service name.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        if (!description.trim()) {
            await Swal.fire({
                icon: "warning",
                title: "Description Required",
                text: "Please enter a description for your service.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        const durationNumber = Number(duration);

        if (
            !duration.trim() ||
            Number.isNaN(durationNumber) ||
            durationNumber <= 0
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Invalid Duration",
                text: "Please enter a valid duration in minutes.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        const priceNumber = Number(price);

        if (
            !price.trim() ||
            Number.isNaN(priceNumber) ||
            priceNumber < 0
        ) {
            await Swal.fire({
                icon: "warning",
                title: "Invalid Price",
                text: "Please enter a valid service price.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        if (availableDays.length === 0) {
            await Swal.fire({
                icon: "warning",
                title: "Select Available Days",
                text: "Please select at least one day.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        if (availableSlots.length === 0) {
            await Swal.fire({
                icon: "warning",
                title: "Select Time Slots",
                text: "Please select at least one available time slot.",
                confirmButtonColor: "#0f172a",
            });

            return;
        }

        try {
            setLoading(true);

            const currentUser = await getCurrentUser();

            const serviceData: CreateServiceData = {
                userId: currentUser.$id,
                serviceName: serviceName.trim(),
                description: description.trim(),
                duration: durationNumber,
                price: priceNumber,
                availableDays,
                availableSlots,
            };

            await createService(serviceData);

            await Swal.fire({
                icon: "success",
                title: "Service Published",
                text: "Your service has been successfully published.",
                confirmButtonText: "Continue",
                confirmButtonColor: "#0f172a",
                timer: 1800,
                timerProgressBar: true,
            });

            router.push("/dashboard/professionals/services");
        } catch (error) {
            console.error(
                "Create service error:",
                error
            );

            await Swal.fire({
                icon: "error",
                title: "Unable to Publish Service",
                text: "Something went wrong while publishing your service. Please try again.",
                confirmButtonText: "Try Again",
                confirmButtonColor: "#0f172a",
            });
        } finally {
            setLoading(false);
        }
    };

    /* ============================================================
       PAGE
    ============================================================ */

    return (
        <main className="min-h-screen bg-[#f5f7f9]">

            {/* ========================================================
                HEADER
            ======================================================== */}

            <header className="border-b border-slate-200 bg-white">

                <div className="mx-auto flex h-[76px] max-w-[1200px] items-center justify-between px-5 sm:px-8">

                    <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center bg-slate-950 text-sm font-bold text-white">
                            H
                        </div>

                        <div>

                            <h1 className="text-lg font-bold tracking-tight text-slate-950">
                                HomeMate
                            </h1>

                            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-slate-400">
                                Professional Services
                            </p>

                        </div>

                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/dashboard/professionals/services"
                            )
                        }
                        className="border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-950 hover:bg-slate-950 hover:text-white"
                    >
                        ← Back to Services
                    </button>

                </div>

            </header>


            {/* ========================================================
                CONTENT
            ======================================================== */}

            <div className="mx-auto max-w-[1000px] px-5 py-8 sm:px-8 lg:py-10">

                {/* Page heading */}

                <section className="mb-8">

                    <div className="mb-4 flex items-center gap-3">

                        <span className="h-px w-10 bg-[#caa66a]" />

                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                            Service Management
                        </span>

                    </div>

                    <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                        Publish a Service
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Create a professional service that customers can
                        discover and book through HomeMate.
                    </p>

                </section>


                {/* ====================================================
                    FORM
                ==================================================== */}

                <section className="border border-slate-200 bg-white">

                    {/* Form header */}

                    <div className="border-b border-slate-100 px-6 py-5 sm:px-8">

                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                            Service Information
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-slate-950">
                            Service Details
                        </h3>

                    </div>


                    <div className="space-y-8 px-6 py-7 sm:px-8">


                        {/* ==================================================
                            BASIC INFORMATION
                        ================================================== */}

                        <div>

                            <div className="mb-5">

                                <h4 className="text-sm font-bold text-slate-950">
                                    Basic Information
                                </h4>

                                <p className="mt-1 text-xs text-slate-400">
                                    Tell customers what service you provide.
                                </p>

                            </div>


                            {/* Service Name */}

                            <div className="mb-5">

                                <label
                                    htmlFor="serviceName"
                                    className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
                                >
                                    Service Name
                                </label>

                                <input
                                    id="serviceName"
                                    type="text"
                                    value={serviceName}
                                    onChange={(event) =>
                                        setServiceName(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Example: AC Repair & Servicing"
                                    maxLength={100}
                                    className="w-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-950"
                                />

                            </div>


                            {/* Description */}

                            <div>

                                <label
                                    htmlFor="description"
                                    className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
                                >
                                    Description
                                </label>

                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(event) =>
                                        setDescription(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Describe what is included in this service..."
                                    rows={5}
                                    className="w-full resize-none border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-950"
                                />

                            </div>

                        </div>


                        {/* ==================================================
                            PRICE + DURATION
                        ================================================== */}

                        <div className="border-t border-slate-100 pt-8">

                            <div className="mb-5">

                                <h4 className="text-sm font-bold text-slate-950">
                                    Service Pricing
                                </h4>

                                <p className="mt-1 text-xs text-slate-400">
                                    Set the estimated service duration and price.
                                </p>

                            </div>


                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                                {/* Duration */}

                                <div>

                                    <label
                                        htmlFor="duration"
                                        className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
                                    >
                                        Estimated Duration
                                    </label>

                                    <div className="relative">

                                        <input
                                            id="duration"
                                            type="number"
                                            min="1"
                                            value={duration}
                                            onChange={(event) =>
                                                setDuration(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="60"
                                            className="w-full border border-slate-200 bg-white px-4 py-3 pr-20 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-950"
                                        />

                                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                            minutes
                                        </span>

                                    </div>

                                </div>


                                {/* Price */}

                                <div>

                                    <label
                                        htmlFor="price"
                                        className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
                                    >
                                        Service Price
                                    </label>

                                    <div className="relative">

                                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                                            ₹
                                        </span>

                                        <input
                                            id="price"
                                            type="number"
                                            min="0"
                                            value={price}
                                            onChange={(event) =>
                                                setPrice(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="800"
                                            className="w-full border border-slate-200 bg-white px-4 py-3 pl-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-950"
                                        />

                                    </div>

                                </div>

                            </div>

                        </div>


                        {/* ==================================================
                            AVAILABLE DAYS
                        ================================================== */}

                        <div className="border-t border-slate-100 pt-8">

                            <div className="mb-5">

                                <h4 className="text-sm font-bold text-slate-950">
                                    Available Days
                                </h4>

                                <p className="mt-1 text-xs text-slate-400">
                                    Select the days when customers can request
                                    this service.
                                </p>

                            </div>


                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                                {DAYS.map((day) => {

                                    const selected =
                                        availableDays.includes(day);

                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() =>
                                                toggleDay(day)
                                            }
                                            className={`border px-4 py-3 text-xs font-bold transition ${
                                                selected
                                                    ? "border-slate-950 bg-slate-950 text-white"
                                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-950"
                                            }`}
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                {day}

                                                {selected && (
                                                    <span>
                                                        ✓
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}

                            </div>

                        </div>


                        {/* ==================================================
                            AVAILABLE TIME SLOTS
                        ================================================== */}

                        <div className="border-t border-slate-100 pt-8">

                            <div className="mb-5">

                                <h4 className="text-sm font-bold text-slate-950">
                                    Available Time Slots
                                </h4>

                                <p className="mt-1 text-xs text-slate-400">
                                    Select all time slots during which you
                                    accept service requests.
                                </p>

                            </div>


                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">

                                {TIME_SLOTS.map((slot) => {

                                    const selected =
                                        availableSlots.includes(slot);

                                    return (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() =>
                                                toggleSlot(slot)
                                            }
                                            className={`border px-4 py-3 text-xs font-bold transition ${
                                                selected
                                                    ? "border-slate-950 bg-slate-950 text-white"
                                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-950"
                                            }`}
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                {slot}

                                                {selected && (
                                                    <span>
                                                        ✓
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}

                            </div>

                        </div>


                        {/* ==================================================
                            SUMMARY
                        ================================================== */}

                        <div className="border-t border-slate-100 pt-8">

                            <div className="border border-slate-200 bg-slate-50 p-5">

                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Service Summary
                                </p>

                                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">

                                    <div>
                                        <p className="text-[10px] text-slate-400">
                                            Service
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-950">
                                            {serviceName || "Not set"}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] text-slate-400">
                                            Duration
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-950">
                                            {duration
                                                ? `${duration} minutes`
                                                : "Not set"}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] text-slate-400">
                                            Price
                                        </p>

                                        <p className="mt-1 text-sm font-bold text-slate-950">
                                            {price
                                                ? `₹${price}`
                                                : "Not set"}
                                        </p>
                                    </div>

                                </div>

                                <div className="mt-4 border-t border-slate-200 pt-4">

                                    <div className="flex flex-wrap gap-2">

                                        <span className="border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">
                                            {availableDays.length}{" "}
                                            {availableDays.length === 1
                                                ? "day"
                                                : "days"}{" "}
                                            selected
                                        </span>

                                        <span className="border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">
                                            {availableSlots.length}{" "}
                                            {availableSlots.length === 1
                                                ? "slot"
                                                : "slots"}{" "}
                                            selected
                                        </span>

                                    </div>

                                </div>

                            </div>

                        </div>


                        {/* ==================================================
                            ACTIONS
                        ================================================== */}

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-8 sm:flex-row sm:justify-end">

                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/dashboard/professionals/services"
                                    )
                                }
                                disabled={loading}
                                className="border border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-600 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="border border-slate-950 bg-slate-950 px-6 py-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading
                                    ? "Publishing..."
                                    : "Publish Service →"}
                            </button>

                        </div>

                    </div>

                </section>


                {/* ========================================================
                    FOOTER
                ======================================================== */}

                <footer className="mt-8 border-t border-slate-200 py-6">

                    <p className="text-center text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                        HomeMate • Professional Service Management
                    </p>

                </footer>

            </div>

        </main>
    );
}