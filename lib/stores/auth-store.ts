import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthRole =
    | "customer"
    | "professional"
    | "business"
    | "admin";

    export interface AuthUser {
    userId: string;
    memberId: string;
    fullName: string;
    email: string;
    role: AuthRole;
    profileImage?: string;
}

interface AuthStore {
    user: AuthUser | null;
    isAuthenticated: boolean;

    setUser: (user: AuthUser) => void;
    clearUser: () => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,

            setUser: (user) =>
                set({
                    user,
                    isAuthenticated: true,
                }),

            clearUser: () =>
                set({
                    user: null,
                    isAuthenticated: false,
                }),
        }),
        {
            name: "homemate-auth",
        }
    )
);