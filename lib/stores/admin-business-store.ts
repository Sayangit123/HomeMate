import { create } from "zustand";

export type BusinessVerificationFilter =
    | "all"
    | "Pending"
    | "Approved"
    | "Rejected";

interface AdminBusinessesStore {
    searchTerm: string;
    verificationFilter: BusinessVerificationFilter;

    setSearchTerm: (value: string) => void;

    setVerificationFilter: (
        value: BusinessVerificationFilter
    ) => void;

    resetFilters: () => void;
}

export const useAdminBusinessesStore =
    create<AdminBusinessesStore>((set) => ({
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