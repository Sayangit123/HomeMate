import { create } from "zustand";

export type WarrantyStatus =
    | "Active"
    | "Expired"
    | "Claimed"
    | "Cancelled";

interface WarrantyStore {
    selectedBookingId: string;
    warrantyPeriod: string;
    warrantyStartDate: string;
    warrantyExpiryDate: string;
    warrantyTerms: string;
    status: WarrantyStatus;

    setSelectedBookingId: (value: string) => void;
    setWarrantyPeriod: (value: string) => void;
    setWarrantyStartDate: (value: string) => void;
    setWarrantyExpiryDate: (value: string) => void;
    setWarrantyTerms: (value: string) => void;
    setStatus: (value: WarrantyStatus) => void;
    resetForm: () => void;
}

export const useWarrantyStore =
    create<WarrantyStore>((set) => ({
        selectedBookingId: "",
        warrantyPeriod: "",
        warrantyStartDate: "",
        warrantyExpiryDate: "",
        warrantyTerms: "",
        status: "Active",

        setSelectedBookingId: (value) =>
            set({ selectedBookingId: value }),

        setWarrantyPeriod: (value) =>
            set({ warrantyPeriod: value }),

        setWarrantyStartDate: (value) =>
            set({ warrantyStartDate: value }),

        setWarrantyExpiryDate: (value) =>
            set({ warrantyExpiryDate: value }),

        setWarrantyTerms: (value) =>
            set({ warrantyTerms: value }),

        setStatus: (value) =>
            set({ status: value }),

        resetForm: () =>
            set({
                selectedBookingId: "",
                warrantyPeriod: "",
                warrantyStartDate: "",
                warrantyExpiryDate: "",
                warrantyTerms: "",
                status: "Active",
            }),
    }));