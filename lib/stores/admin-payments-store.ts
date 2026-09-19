import { create } from "zustand";

export type AdminPaymentStatus =
    | "All"
    | "Pending"
    | "Completed"
    | "Failed"
    | "Refunded"
    | "Partially Refunded";

export type AdminPaymentMethod =
    | "All"
    | "Card"
    | "UPI"
    | "Net Banking"
    | "Wallet"
    | "Cash";

interface AdminPaymentsStore {
    search: string;

    statusFilter: AdminPaymentStatus;

    paymentMethodFilter: AdminPaymentMethod;

    selectedPaymentId: string | null;

    setSearch: (
        value: string
    ) => void;

    setStatusFilter: (
        value: AdminPaymentStatus
    ) => void;

    setPaymentMethodFilter: (
        value: AdminPaymentMethod
    ) => void;

    setSelectedPaymentId: (
        value: string | null
    ) => void;

    resetFilters: () => void;
}

export const useAdminPaymentsStore =
    create<AdminPaymentsStore>((set) => ({
        search: "",

        statusFilter: "All",

        paymentMethodFilter: "All",

        selectedPaymentId: null,

        setSearch: (value) =>
            set({
                search: value,
            }),

        setStatusFilter: (value) =>
            set({
                statusFilter: value,
            }),

        setPaymentMethodFilter: (value) =>
            set({
                paymentMethodFilter: value,
            }),

        setSelectedPaymentId: (value) =>
            set({
                selectedPaymentId: value,
            }),

        resetFilters: () =>
            set({
                search: "",
                statusFilter: "All",
                paymentMethodFilter: "All",
                selectedPaymentId: null,
            }),
    }));