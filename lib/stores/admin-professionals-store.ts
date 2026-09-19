import { create } from "zustand";

export type VerificationFilter =
    | "all"
    | "Pending"
    | "Approved"
    | "Rejected";

interface AdminProfessionalsStore {
    searchTerm: string;
    verificationFilter: VerificationFilter;

    setSearchTerm: (value: string) => void;

    setVerificationFilter: (
        value: VerificationFilter
    ) => void;

    resetFilters: () => void;
}

export const useAdminProfessionalsStore =
    create<AdminProfessionalsStore>((set) => ({
        searchTerm: "",
        verificationFilter: "all",

        setSearchTerm: (value) =>
            set({
                searchTerm: value,
            }),

        setVerificationFilter: (value) =>
            set({
                verificationFilter: value,
            }),

        resetFilters: () =>
            set({
                searchTerm: "",
                verificationFilter: "all",
            }),
    }));