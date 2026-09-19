import { create } from "zustand";

import {
    ComplaintStatus,
    ComplaintType,
} from "@/lib/appwrite/complaint";

interface AdminComplaintsStore {
    search: string;
    typeFilter: ComplaintType | "All";
    statusFilter: ComplaintStatus | "All";
    selectedComplaintId: string | null;

    setSearch: (value: string) => void;

    setTypeFilter: (
        value: ComplaintType | "All"
    ) => void;

    setStatusFilter: (
        value: ComplaintStatus | "All"
    ) => void;

    setSelectedComplaintId: (
        value: string | null
    ) => void;

    resetFilters: () => void;
}

export const useAdminComplaintsStore =
    create<AdminComplaintsStore>(
        (set) => ({
            search: "",

            typeFilter: "All",

            statusFilter: "All",

            selectedComplaintId:
                null,

            setSearch: (value) =>
                set({
                    search: value,
                }),

            setTypeFilter: (value) =>
                set({
                    typeFilter: value,
                }),

            setStatusFilter: (value) =>
                set({
                    statusFilter: value,
                }),

            setSelectedComplaintId:
                (value) =>
                    set({
                        selectedComplaintId:
                            value,
                    }),

            resetFilters: () =>
                set({
                    search: "",
                    typeFilter: "All",
                    statusFilter: "All",
                    selectedComplaintId:
                        null,
                }),
        })
    );