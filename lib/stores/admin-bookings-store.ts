import { create } from "zustand";
import { BookingStatus } from "@/lib/appwrite/booking";

export type AdminBookingStatusFilter =
    | "All"
    | BookingStatus;

interface AdminBookingsStore {
    search: string;
    statusFilter: AdminBookingStatusFilter;
    updatingId: string | null;

    setSearch: (value: string) => void;

    setStatusFilter: (
        value: AdminBookingStatusFilter
    ) => void;

    setUpdatingId: (
        value: string | null
    ) => void;

    resetFilters: () => void;
}

export const useAdminBookingsStore =
    create<AdminBookingsStore>((set) => ({
        search: "",
        statusFilter: "All",
        updatingId: null,

        setSearch: (value) =>
            set({
                search: value,
            }),

        setStatusFilter: (value) =>
            set({
                statusFilter: value,
            }),

        setUpdatingId: (value) =>
            set({
                updatingId: value,
            }),

        resetFilters: () =>
            set({
                search: "",
                statusFilter: "All",
                updatingId: null,
            }),
    }));