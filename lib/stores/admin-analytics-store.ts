import { create } from "zustand";

export type AnalyticsPeriod =
    | "all"
    | "7"
    | "30"
    | "90";

interface AdminAnalyticsStore {
    period: AnalyticsPeriod;

    setPeriod: (
        value: AnalyticsPeriod
    ) => void;

    resetPeriod: () => void;
}

export const useAdminAnalyticsStore =
    create<AdminAnalyticsStore>(
        (set) => ({
            period: "all",

            setPeriod: (value) =>
                set({
                    period: value,
                }),

            resetPeriod: () =>
                set({
                    period: "all",
                }),
        })
    );