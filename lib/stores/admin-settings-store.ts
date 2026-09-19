import { create } from "zustand";

import {
    PlatformSettings,
} from "@/lib/appwrite/platform-settings";

interface AdminSettingsStore {
    settings: PlatformSettings | null;

    setSettings: (
        settings: PlatformSettings
    ) => void;

    updateLocalField: <
        K extends keyof PlatformSettings
    >(
        field: K,
        value: PlatformSettings[K]
    ) => void;

    resetSettings: () => void;
}

export const useAdminSettingsStore =
    create<AdminSettingsStore>((set) => ({
        settings: null,

        setSettings: (settings) =>
            set({
                settings,
            }),

        updateLocalField: (
            field,
            value
        ) =>
            set((state) => ({
                settings: state.settings
                    ? {
                          ...state.settings,
                          [field]: value,
                      }
                    : null,
            })),

        resetSettings: () =>
            set({
                settings: null,
            }),
    }));