"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "@/lib/appwrite/account";
import {
  getUserMaintenance,
} from "@/lib/appwrite/maintenance";
import {
  getUserProperties,
} from "@/lib/appwrite/property";

import {
  useMaintenanceHistoryStore,
} from "@/lib/stores/maintenance-history-store";

interface Property {
  $id: string;
  propertyName: string;
}

interface MaintenanceRecord {
  $id: string;
  propertyId: string;
  title: string;
  category: string;
  description?: string | null;
  maintenanceDate: string;
  status: string;
  cost?: number | null;
  providerName?: string | null;
  notes?: string | null;
}

export default function MaintenanceHistoryPage() {
  const router = useRouter();

  const {
    search,
    statusFilter,
    categoryFilter,
    setSearch,
    setStatusFilter,
    setCategoryFilter,
  } = useMaintenanceHistoryStore();

  // -----------------------------------------
  // Load Data with TanStack Query
  // -----------------------------------------

  const historyQuery = useQuery({
    queryKey: ["maintenance-history"],

    queryFn: async () => {
      const user = await getCurrentUser();

      const [
        maintenanceResponse,
        propertiesResponse,
      ] = await Promise.all([
        getUserMaintenance(user.$id),
        getUserProperties(user.$id),
      ]);

      return {
        maintenance:
          maintenanceResponse.documents as unknown as MaintenanceRecord[],

        properties:
          propertiesResponse.documents as unknown as Property[],
      };
    },
  });

  const maintenance =
    historyQuery.data?.maintenance || [];

  const properties =
    historyQuery.data?.properties || [];

  const loading =
    historyQuery.isLoading;

  // -----------------------------------------
  // Property Name
  // -----------------------------------------

  const getPropertyName = (
    propertyId: string
  ) => {
    const property = properties.find(
      (item) =>
        item.$id === propertyId
    );

    return (
      property?.propertyName ||
      "Unknown Property"
    );
  };

  // -----------------------------------------
  // Format Date
  // -----------------------------------------

  const formatDate = (
    date: string
  ) => {
    if (!date) return "—";

    return new Date(
      date
    ).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // -----------------------------------------
  // History Records
  //
  // Completed and Cancelled records are treated
  // as historical maintenance records.
  // -----------------------------------------

  const historyRecords =
    useMemo(() => {
      return maintenance.filter(
        (item) =>
          item.status ===
            "Completed" ||
          item.status ===
            "Cancelled"
      );
    }, [maintenance]);

  // -----------------------------------------
  // Search + Filters
  // -----------------------------------------

  const filteredHistory =
    useMemo(() => {
      return historyRecords.filter(
        (item) => {
          const searchText =
            search.toLowerCase();

          const matchesSearch =
            item.title
              .toLowerCase()
              .includes(searchText) ||
            item.category
              .toLowerCase()
              .includes(searchText) ||
            getPropertyName(
              item.propertyId
            )
              .toLowerCase()
              .includes(searchText) ||
            (
              item.providerName ||
              ""
            )
              .toLowerCase()
              .includes(searchText);

          const matchesStatus =
            statusFilter === "All" ||
            item.status ===
              statusFilter;

          const matchesCategory =
            categoryFilter === "All" ||
            item.category ===
              categoryFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesCategory
          );
        }
      );
    }, [
      historyRecords,
      properties,
      search,
      statusFilter,
      categoryFilter,
    ]);

  // -----------------------------------------
  // Statistics
  // -----------------------------------------

  const completedCount =
    historyRecords.filter(
      (item) =>
        item.status ===
        "Completed"
    ).length;

  const cancelledCount =
    historyRecords.filter(
      (item) =>
        item.status ===
        "Cancelled"
    ).length;

  const totalHistoryCost =
    historyRecords.reduce(
      (total, item) =>
        total +
        Number(
          item.cost || 0
        ),
      0
    );

  // -----------------------------------------
  // Status Styling
  // -----------------------------------------

  const getStatusClass = (
    status: string
  ) => {
    if (
      status ===
      "Completed"
    ) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    }

    if (
      status ===
      "Cancelled"
    ) {
      return "border-red-500/30 bg-red-500/10 text-red-400";
    }

    return "border-slate-700 bg-slate-800 text-slate-300";
  };

  // -----------------------------------------
  // Page
  // -----------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">

      <div className="mx-auto max-w-7xl">

        {/* Header */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/maintenance"
                )
              }
              className="mb-5 text-sm text-blue-400 transition hover:text-blue-300"
            >
              ← Back to Maintenance
            </button>

            <p className="mb-2 text-sm font-medium tracking-wide text-blue-400">
              MAINTENANCE MANAGEMENT
            </p>

            <h1 className="text-3xl font-bold tracking-tight">
              Maintenance History
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Review completed and cancelled maintenance
              work across your properties.
            </p>

          </div>

          <div className="flex flex-col gap-3 sm:flex-row">

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/maintenance/upcoming"
                )
              }
              className="border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-blue-500 hover:text-blue-400"
            >
              Upcoming Maintenance
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/maintenance/add"
                )
              }
              className="bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              + Add Maintenance
            </button>

          </div>

        </div>

        {/* Statistics */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <div className="border border-slate-800 bg-slate-900 p-5">

            <p className="text-sm text-slate-400">
              Completed
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-400">
              {completedCount}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Completed maintenance records
            </p>

          </div>

          <div className="border border-slate-800 bg-slate-900 p-5">

            <p className="text-sm text-slate-400">
              Cancelled
            </p>

            <p className="mt-2 text-3xl font-bold text-red-400">
              {cancelledCount}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Cancelled maintenance records
            </p>

          </div>

          <div className="border border-slate-800 bg-slate-900 p-5">

            <p className="text-sm text-slate-400">
              Total Historical Cost
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              ₹
              {totalHistoryCost.toLocaleString(
                "en-IN"
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Cost of historical maintenance
            </p>

          </div>

        </div>

        {/* Filters */}

        <div className="mb-6 border border-slate-800 bg-slate-900 p-5">

          <div className="grid gap-4 md:grid-cols-3">

            {/* Search */}

            <div>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Search
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search history..."
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500"
              />

            </div>

            {/* Status */}

            <div>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              >

                <option value="All">
                  All History
                </option>

                <option value="Completed">
                  Completed
                </option>

                <option value="Cancelled">
                  Cancelled
                </option>

              </select>

            </div>

            {/* Category */}

            <div>

              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Category
              </label>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              >

                <option value="All">
                  All Categories
                </option>

                <option value="General">
                  General
                </option>

                <option value="Electrical">
                  Electrical
                </option>

                <option value="Plumbing">
                  Plumbing
                </option>

                <option value="Cleaning">
                  Cleaning
                </option>

                <option value="AC">
                  AC
                </option>

                <option value="Appliance">
                  Appliance
                </option>

                <option value="Painting">
                  Painting
                </option>

                <option value="Pest Control">
                  Pest Control
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>

          </div>

        </div>

        {/* History Records */}

        <div className="border border-slate-800 bg-slate-900">

          <div className="border-b border-slate-800 px-6 py-5">

            <h2 className="text-lg font-semibold">
              Maintenance History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredHistory.length} record
              {filteredHistory.length !==
              1
                ? "s"
                : ""}{" "}
              found
            </p>

          </div>

          {/* Error */}

          {historyQuery.isError ? (

            <div className="px-6 py-16 text-center">

              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-red-500/30 bg-red-500/10 text-2xl">
                ⚠️
              </div>

              <h3 className="text-lg font-semibold">
                Unable to Load History
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Please try again.
              </p>

              <button
                type="button"
                onClick={() =>
                  historyQuery.refetch()
                }
                className="mt-6 border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
              >
                ↻ Try Again
              </button>

            </div>

          ) : loading ? (

            /* Loading */

            <div className="px-6 py-16 text-center">

              <div className="mx-auto mb-4 h-8 w-8 animate-spin border-2 border-slate-700 border-t-blue-500" />

              <p className="text-sm text-slate-400">
                Loading maintenance history...
              </p>

            </div>

          ) : filteredHistory.length ===
            0 ? (

            /* Empty */

            <div className="px-6 py-16 text-center">

              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-slate-700 bg-slate-950 text-2xl">
                ✓
              </div>

              <h3 className="text-lg font-semibold">
                No Maintenance History
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {historyRecords.length ===
                0
                  ? "Completed or cancelled maintenance records will appear here."
                  : "No historical records match your current search or filters."}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/dashboard/maintenance"
                  )
                }
                className="mt-6 border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
              >
                View All Maintenance
              </button>

            </div>

          ) : (

            <>

              {/* Desktop Table */}

              <div className="hidden overflow-x-auto lg:block">

                <table className="w-full">

                  <thead>

                    <tr className="border-b border-slate-800 text-left">

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Maintenance
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Property
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Category
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Cost
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredHistory.map(
                      (item) => (

                        <tr
                          key={
                            item.$id
                          }
                          className="border-b border-slate-800 transition hover:bg-slate-800/30"
                        >

                          <td className="px-6 py-5">

                            <p className="font-medium text-white">
                              {
                                item.title
                              }
                            </p>

                            {item.providerName && (
                              <p className="mt-1 text-xs text-slate-500">
                                {
                                  item.providerName
                                }
                              </p>
                            )}

                          </td>

                          <td className="px-6 py-5 text-sm text-slate-300">
                            {getPropertyName(
                              item.propertyId
                            )}
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-300">
                            {
                              item.category
                            }
                          </td>

                          <td className="px-6 py-5 text-sm text-slate-400">
                            {formatDate(
                              item.maintenanceDate
                            )}
                          </td>

                          <td className="px-6 py-5">

                            <span
                              className={`inline-flex border px-3 py-1 text-xs font-medium ${getStatusClass(
                                item.status
                              )}`}
                            >
                              {
                                item.status
                              }
                            </span>

                          </td>

                          <td className="px-6 py-5 text-sm font-medium text-white">

                            ₹
                            {Number(
                              item.cost ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}

                          </td>

                          <td className="px-6 py-5">

                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/dashboard/maintenance/${item.$id}`
                                )
                              }
                              className="border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                            >
                              View Details
                            </button>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

              {/* Mobile / Tablet */}

              <div className="grid gap-4 p-4 lg:hidden">

                {filteredHistory.map(
                  (item) => (

                    <div
                      key={
                        item.$id
                      }
                      className="border border-slate-800 bg-slate-950 p-5"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <h3 className="font-semibold text-white">
                            {
                              item.title
                            }
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {getPropertyName(
                              item.propertyId
                            )}
                          </p>

                        </div>

                        <span
                          className={`shrink-0 border px-3 py-1 text-xs font-medium ${getStatusClass(
                            item.status
                          )}`}
                        >
                          {
                            item.status
                          }
                        </span>

                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4">

                        <div>

                          <p className="text-xs text-slate-500">
                            Category
                          </p>

                          <p className="mt-1 text-sm text-slate-300">
                            {
                              item.category
                            }
                          </p>

                        </div>

                        <div>

                          <p className="text-xs text-slate-500">
                            Date
                          </p>

                          <p className="mt-1 text-sm text-slate-300">
                            {formatDate(
                              item.maintenanceDate
                            )}
                          </p>

                        </div>

                        <div>

                          <p className="text-xs text-slate-500">
                            Cost
                          </p>

                          <p className="mt-1 text-sm font-medium text-white">

                            ₹
                            {Number(
                              item.cost ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}

                          </p>

                        </div>

                        <div>

                          <p className="text-xs text-slate-500">
                            Provider
                          </p>

                          <p className="mt-1 truncate text-sm text-slate-300">
                            {
                              item.providerName ||
                              "—"
                            }
                          </p>

                        </div>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/dashboard/maintenance/${item.$id}`
                          )
                        }
                        className="mt-5 w-full border border-slate-700 px-4 py-3 text-sm text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                      >
                        View Details
                      </button>

                    </div>

                  )
                )}

              </div>

            </>

          )}

        </div>

      </div>

    </main>
  );
}