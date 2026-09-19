import { create } from "zustand";

interface ProfessionalStore {
    selectedProfessionalId: string | null;

    selectedCategory: string;
    selectedDistance: string;
    selectedRating: string;
    selectedAvailability: string;
    selectedPrice: string;

    setSelectedProfessionalId: (professionalId: string | null) => void;

    setSelectedCategory: (category: string) => void;
    setSelectedDistance: (distance: string) => void;
    setSelectedRating: (rating: string) => void;
    setSelectedAvailability: (availability: string) => void;
    setSelectedPrice: (price: string) => void;

    clearSelectedProfessional: () => void;

    resetFilters: () => void;
}

export const useProfessionalStore =
    create<ProfessionalStore>((set) => ({
        selectedProfessionalId: null,

        selectedCategory: "All Categories",
        selectedDistance: "Any Distance",
        selectedRating: "Any Rating",
        selectedAvailability: "Any Availability",
        selectedPrice: "Any Price",

        setSelectedProfessionalId: (professionalId) =>
            set({
                selectedProfessionalId: professionalId,
            }),

        setSelectedCategory: (category) =>
            set({
                selectedCategory: category,
            }),

        setSelectedDistance: (distance) =>
            set({
                selectedDistance: distance,
            }),

        setSelectedRating: (rating) =>
            set({
                selectedRating: rating,
            }),

        setSelectedAvailability: (availability) =>
            set({
                selectedAvailability: availability,
            }),

        setSelectedPrice: (price) =>
            set({
                selectedPrice: price,
            }),

        clearSelectedProfessional: () =>
            set({
                selectedProfessionalId: null,
            }),

        resetFilters: () =>
            set({
                selectedCategory: "All Categories",
                selectedDistance: "Any Distance",
                selectedRating: "Any Rating",
                selectedAvailability: "Any Availability",
                selectedPrice: "Any Price",
            }),
    }));