import { create } from "zustand";

export type VerificationStatusFilter =
    | "all"
    | "Pending"
    | "Approved"
    | "Rejected";

interface AdminProfessionalVerificationStore {
    statusFilter: VerificationStatusFilter;

    setStatusFilter: (
        value: VerificationStatusFilter
    ) => void;

    resetFilter: () => void;
}

export const useAdminProfessionalVerificationStore =
    create<AdminProfessionalVerificationStore>(
        (set) => ({
            statusFilter: "Pending",

            setStatusFilter: (value) =>
                set({
                    statusFilter: value,
                }),

            resetFilter: () =>
                set({
                    statusFilter: "Pending",
                }),
        })
    );