import { create } from "zustand";

export type AdminUserRoleFilter =
    | "all"
    | "customer"
    | "professional"
    | "business";

interface AdminUsersStore {
    searchTerm: string;
    roleFilter: AdminUserRoleFilter;
    selectedUserId: string | null;

    setSearchTerm: (value: string) => void;

    setRoleFilter: (
        value: AdminUserRoleFilter
    ) => void;

    setSelectedUserId: (
        value: string | null
    ) => void;

    resetFilters: () => void;
}

export const useAdminUsersStore =
    create<AdminUsersStore>((set) => ({
        searchTerm: "",
        roleFilter: "all",
        selectedUserId: null,

        setSearchTerm: (value) =>
            set({
                searchTerm: value,
            }),

        setRoleFilter: (value) =>
            set({
                roleFilter: value,
            }),

        setSelectedUserId: (value) =>
            set({
                selectedUserId: value,
            }),

        resetFilters: () =>
            set({
                searchTerm: "",
                roleFilter: "all",
                selectedUserId: null,
            }),
    }));