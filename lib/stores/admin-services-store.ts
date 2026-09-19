import { create } from "zustand";

interface AdminServicesStore {
    search: string;
    categoryFilter: string;

    setSearch: (value: string) => void;

    setCategoryFilter: (
        value: string
    ) => void;

    resetFilters: () => void;
}

export const useAdminServicesStore =
    create<AdminServicesStore>((set) => ({
        search: "",
        categoryFilter: "All",

        setSearch: (value) =>
            set({
                search: value,
            }),

        setCategoryFilter: (value) =>
            set({
                categoryFilter: value,
            }),

        resetFilters: () =>
            set({
                search: "",
                categoryFilter: "All",
            }),
    }));