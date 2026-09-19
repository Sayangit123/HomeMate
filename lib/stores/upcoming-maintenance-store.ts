import { create } from "zustand";

interface UpcomingMaintenanceStore {
    selectedMaintenanceId: string | null;

    setSelectedMaintenanceId: (
        maintenanceId: string | null
    ) => void;

    clearSelectedMaintenanceId: () => void;
}

export const useUpcomingMaintenanceStore =
    create<UpcomingMaintenanceStore>((set) => ({
        selectedMaintenanceId: null,

        setSelectedMaintenanceId: (
            maintenanceId
        ) =>
            set({
                selectedMaintenanceId:
                    maintenanceId,
            }),

        clearSelectedMaintenanceId: () =>
            set({
                selectedMaintenanceId: null,
            }),
    }));