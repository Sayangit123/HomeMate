import { create } from "zustand";

interface MarketplaceStore {
    searchTerm: string;
    selectedCategory: string;
    sortBy: string;

    setSearchTerm: (value: string) => void;
    setSelectedCategory: (value: string) => void;
    setSortBy: (value: string) => void;

    clearFilters: () => void;
}

export const useMarketplaceStore =
    create<MarketplaceStore>((set) => ({
        searchTerm: "",
        selectedCategory: "All Categories",
        sortBy: "newest",

        setSearchTerm: (value) =>
            set({
                searchTerm: value,
            }),

        setSelectedCategory: (value) =>
            set({
                selectedCategory: value,
            }),

        setSortBy: (value) =>
            set({
                sortBy: value,
            }),

        clearFilters: () =>
            set({
                searchTerm: "",
                selectedCategory:
                    "All Categories",
                sortBy: "newest",
            }),
    }));