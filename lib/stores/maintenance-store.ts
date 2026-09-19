import { create } from "zustand";

interface MaintenanceStore {
  search: string;
  statusFilter: string;
  categoryFilter: string;

  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setCategoryFilter: (value: string) => void;

  resetFilters: () => void;
}

export const useMaintenanceStore =
  create<MaintenanceStore>((set) => ({
    search: "",
    statusFilter: "All",
    categoryFilter: "All",

    setSearch: (value) =>
      set({
        search: value,
      }),

    setStatusFilter: (value) =>
      set({
        statusFilter: value,
      }),

    setCategoryFilter: (value) =>
      set({
        categoryFilter: value,
      }),

    resetFilters: () =>
      set({
        search: "",
        statusFilter: "All",
        categoryFilter: "All",
      }),
  }));