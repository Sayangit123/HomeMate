import { create } from "zustand";

interface PropertyStore {
    selectedPropertyId: string | null;

    setSelectedPropertyId: (propertyId: string) => void;

    clearSelectedProperty: () => void;
}

export const usePropertyStore = create<PropertyStore>((set) => ({
    selectedPropertyId: null,

    setSelectedPropertyId: (propertyId) =>
        set({
            selectedPropertyId: propertyId,
        }),

    clearSelectedProperty: () =>
        set({
            selectedPropertyId: null,
        }),
}));