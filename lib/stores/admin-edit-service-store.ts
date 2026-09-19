import { create } from "zustand";

export interface ServiceForm {
    serviceName: string;
    description: string;
    duration: string;
    price: string;
    availableDays: string[];
    availableSlots: string[];
}

interface AdminEditServiceStore {
    draftForm: ServiceForm | null;
    editingServiceId: string | null;

    setField: (
        serviceId: string | null,
        currentForm: ServiceForm,
        field: keyof ServiceForm,
        value: string
    ) => void;

    toggleDay: (
        serviceId: string | null,
        currentForm: ServiceForm,
        day: string
    ) => void;

    toggleSlot: (
        serviceId: string | null,
        currentForm: ServiceForm,
        slot: string
    ) => void;

    resetForm: () => void;
}

export const useAdminEditServiceStore =
    create<AdminEditServiceStore>((set) => ({
        draftForm: null,
        editingServiceId: null,

        setField: (
            serviceId,
            currentForm,
            field,
            value
        ) =>
            set({
                editingServiceId: serviceId,
                draftForm: {
                    ...currentForm,
                    [field]: value,
                },
            }),

        toggleDay: (
            serviceId,
            currentForm,
            day
        ) =>
            set({
                editingServiceId: serviceId,
                draftForm: {
                    ...currentForm,
                    availableDays:
                        currentForm.availableDays.includes(
                            day
                        )
                            ? currentForm.availableDays.filter(
                                  (item) =>
                                      item !== day
                              )
                            : [
                                  ...currentForm.availableDays,
                                  day,
                              ],
                },
            }),

        toggleSlot: (
            serviceId,
            currentForm,
            slot
        ) =>
            set({
                editingServiceId: serviceId,
                draftForm: {
                    ...currentForm,
                    availableSlots:
                        currentForm.availableSlots.includes(
                            slot
                        )
                            ? currentForm.availableSlots.filter(
                                  (item) =>
                                      item !== slot
                              )
                            : [
                                  ...currentForm.availableSlots,
                                  slot,
                              ],
                },
            }),

        resetForm: () =>
            set({
                draftForm: null,
                editingServiceId: null,
            }),
    }));