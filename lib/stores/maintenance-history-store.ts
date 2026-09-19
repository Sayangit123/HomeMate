import { create } from "zustand";

interface MaintenanceHistoryStore {
  search: string;
  statusFilter: string;
  categoryFilter: string;

  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setCategoryFilter: (value: string) => void;

  resetFilters: () => void;
}

export const useMaintenanceHistoryStore =
  create<MaintenanceHistoryStore>((set) => ({
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