import { create } from "zustand";

type ServiceHistorySection =
    | "overview"
    | "services"
    | "maintenance"
    | "invoices"
    | "warranty";

interface ServiceHistoryStore {
    activeSection: ServiceHistorySection;

    setActiveSection: (
        section: ServiceHistorySection
    ) => void;

    resetActiveSection: () => void;
}

export const useServiceHistoryStore =
    create<ServiceHistoryStore>((set) => ({
        activeSection: "overview",

        setActiveSection: (section) =>
            set({
                activeSection: section,
            }),

        resetActiveSection: () =>
            set({
                activeSection: "overview",
            }),
    }));