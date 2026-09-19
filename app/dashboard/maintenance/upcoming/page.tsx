"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "@/lib/appwrite/account";
import { getUserProperties } from "@/lib/appwrite/property";
import {
  getUserMaintenance,
  MaintenanceCategory,
  MaintenanceStatus,
} from "@/lib/appwrite/maintenance";
import {
  useUpcomingMaintenanceStore,
} from "@/lib/stores/upcoming-maintenance-store";

interface MaintenanceRecord {
  $id: string;
  userId: string;
  propertyId: string;
  title: string;
  category: MaintenanceCategory;
  description?: string | null;
  maintenanceDate: string;
  status: MaintenanceStatus;
  cost?: number | null;
  providerName?: string | null;
  notes?: string | null;
}

interface Property {
  $id: string;
  propertyName: string;
}

export default function UpcomingMaintenancePage() {
  const {
    setSelectedMaintenanceId,
  } = useUpcomingMaintenanceStore();

  // -----------------------------------------
  // Load Maintenance + Properties
  // -----------------------------------------

  const maintenanceQuery = useQuery({
    queryKey: ["upcoming-maintenance"],

    queryFn: async () => {
      const user = await getCurrentUser();

      if (!user) {
        window.location.href = "/login";

        throw new Error(
          "User is not authenticated."
        );
      }

      const [
        maintenanceResponse,
        propertiesResponse,
      ] = await Promise.all([
        getUserMaintenance(user.$id),
        getUserProperties(user.$id),
      ]);

      const maintenanceRecords =
        (maintenanceResponse.documents ||
          []) as unknown as MaintenanceRecord[];

      const userProperties =
        (propertiesResponse.documents ||
          []) as unknown as Property[];

      console.log(
        "All maintenance records:",
        maintenanceRecords
      );

      return {
        records: maintenanceRecords,
        properties: userProperties,
      };
    },
  });

  const records =
    maintenanceQuery.data?.records || [];

  const properties =
    maintenanceQuery.data?.properties || [];

  const loading =
    maintenanceQuery.isLoading;

  // -----------------------------------------
  // Query Error
  // -----------------------------------------

  useEffect(() => {
    if (!maintenanceQuery.isError) {
      return;
    }

    console.error(
      "Load upcoming maintenance error:",
      maintenanceQuery.error
    );

    const showError = async () => {
      let message =
        "Unable to load upcoming maintenance.";

      if (
        maintenanceQuery.error instanceof Error
      ) {
        message =
          maintenanceQuery.error.message;
      }

      await Swal.fire({
        icon: "error",
        title: "Unable to Load",
        text: message,
        confirmButtonColor: "#2563eb",
      });
    };

    showError();
  }, [
    maintenanceQuery.isError,
    maintenanceQuery.error,
  ]);

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
  // Convert date to YYYY-MM-DD
  // -----------------------------------------

  const getDateOnly = (
    dateValue: string
  ) => {
    if (!dateValue) {
      return "";
    }

    /*
     * Appwrite may return:
     *
     * 2026-09-15
     *
     * or
     *
     * 2026-09-15T00:00:00.000+00:00
     *
     * We only need the calendar date.
     */

    return dateValue.substring(0, 10);
  };

  // -----------------------------------------
  // Today's date as YYYY-MM-DD
  // -----------------------------------------

  const getTodayDate = () => {
    const today = new Date();

    const year =
      today.getFullYear();

    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      today.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // -----------------------------------------
  // Upcoming Records
  // -----------------------------------------

  const upcomingRecords =
    useMemo(() => {
      const today =
        getTodayDate();

      console.log(
        "Today:",
        today
      );

      const filtered =
        records.filter(
          (record) => {
            const maintenanceDate =
              getDateOnly(
                record.maintenanceDate
              );

            console.log(
              "Checking:",
              record.title,
              maintenanceDate,
              record.status
            );

            // Completed and Cancelled records
            // are not upcoming.
            if (
              record.status ===
                "Completed" ||
              record.status ===
                "Cancelled"
            ) {
              return false;
            }

            // Show today and future dates.
            return (
              maintenanceDate >=
              today
            );
          }
        );

      console.log(
        "Upcoming maintenance:",
        filtered
      );

      return filtered;
    }, [records]);

  // -----------------------------------------
  // Sort by Date
  // -----------------------------------------

  const sortedRecords =
    useMemo(() => {
      return [
        ...upcomingRecords,
      ].sort((a, b) => {
        return getDateOnly(
          a.maintenanceDate
        ).localeCompare(
          getDateOnly(
            b.maintenanceDate
          )
        );
      });
    }, [upcomingRecords]);

  // -----------------------------------------
  // Format Date
  // -----------------------------------------

  const formatDate = (
    date: string
  ) => {
    const dateOnly =
      getDateOnly(date);

    if (!dateOnly) {
      return "—";
    }

    const [
      year,
      month,
      day,
    ] = dateOnly
      .split("-")
      .map(Number);

    const localDate =
      new Date(
        year,
        month - 1,
        day
      );

    return localDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // -----------------------------------------
  // Days Remaining
  // -----------------------------------------

  const getDaysRemaining = (
    date: string
  ) => {
    const dateOnly =
      getDateOnly(date);

    if (!dateOnly) {
      return 0;
    }

    const [
      year,
      month,
      day,
    ] = dateOnly
      .split("-")
      .map(Number);

    const maintenanceDate =
      new Date(
        year,
        month - 1,
        day
      );

    const today =
      new Date();

    const todayOnly =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

    const difference =
      maintenanceDate.getTime() -
      todayOnly.getTime();

    return Math.round(
      difference /
        (1000 * 60 * 60 * 24)
    );
  };

  // -----------------------------------------
  // Status Styling
  // -----------------------------------------

  const getStatusClass = (
    status: MaintenanceStatus
  ) => {
    switch (status) {
      case "Pending":
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";

      case "InProgress":
        return "border-blue-500/30 bg-blue-500/10 text-blue-400";

      case "Completed":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";

      case "Cancelled":
        return "border-red-500/30 bg-red-500/10 text-red-400";

      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  };

  // -----------------------------------------
  // Category Icon
  // -----------------------------------------

  const getCategoryIcon = (
    category: MaintenanceCategory
  ) => {
    switch (category) {
      case "Electrical":
        return "⚡";

      case "Plumbing":
        return "🔧";

      case "Cleaning":
        return "🧹";

      case "AC":
        return "❄️";

      case "Appliance":
        return "🔌";

      case "Painting":
        return "🎨";

      case "Pest Control":
        return "🐜";

      default:
        return "🛠️";
    }
  };

  // -----------------------------------------
  // Loading
  // -----------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex min-h-[60vh] items-center justify-center border border-slate-800 bg-slate-900">
            <div className="text-center">

              <div className="mx-auto mb-5 h-8 w-8 animate-spin border-2 border-slate-700 border-t-blue-500" />

              <p className="text-sm text-slate-400">
                Loading upcoming maintenance...
              </p>

            </div>
          </div>
        </div>
      </main>
    );
  }

  // -----------------------------------------
  // Page
  // -----------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">

      <div className="mx-auto max-w-6xl">

        {/* Header */}

        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">

          <div>

            <Link
              href="/dashboard/maintenance"
              className="mb-5 inline-block text-sm text-slate-400 transition hover:text-white"
            >
              ← Back to Maintenance
            </Link>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-blue-500">
              Maintenance Management
            </p>

            <h1 className="text-3xl font-semibold sm:text-4xl">
              Upcoming Maintenance
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              View scheduled maintenance work for your
              properties and keep track of what needs
              attention next.
            </p>

          </div>

          <Link
            href="/dashboard/maintenance/add"
            className="border border-blue-500 bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            + Add Maintenance
          </Link>

        </div>

        {/* Summary */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <div className="border border-slate-800 bg-slate-900 p-6">

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Upcoming Records
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {sortedRecords.length}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Scheduled maintenance
            </p>

          </div>

          <div className="border border-slate-800 bg-slate-900 p-6">

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Next Maintenance
            </p>

            <p className="mt-3 text-lg font-semibold">

              {sortedRecords.length >
              0
                ? formatDate(
                    sortedRecords[0]
                      .maintenanceDate
                  )
                : "No upcoming"}

            </p>

            <p className="mt-1 text-sm text-slate-500">

              {sortedRecords.length >
              0
                ? getDaysRemaining(
                    sortedRecords[0]
                      .maintenanceDate
                  ) === 0
                  ? "Today"
                  : getDaysRemaining(
                      sortedRecords[0]
                        .maintenanceDate
                    ) === 1
                  ? "Tomorrow"
                  : `${getDaysRemaining(
                      sortedRecords[0]
                        .maintenanceDate
                    )} days remaining`
                : "Everything is up to date"}

            </p>

          </div>

          <div className="border border-slate-800 bg-slate-900 p-6">

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Estimated Cost
            </p>

            <p className="mt-3 text-3xl font-semibold">

              ₹
              {sortedRecords
                .reduce(
                  (
                    total,
                    record
                  ) =>
                    total +
                    Number(
                      record.cost ||
                        0
                    ),
                  0
                )
                .toLocaleString(
                  "en-IN"
                )}

            </p>

            <p className="mt-1 text-sm text-slate-500">
              Upcoming maintenance cost
            </p>

          </div>

        </div>

        {/* Empty State */}

        {sortedRecords.length ===
        0 ? (

          <div className="border border-slate-800 bg-slate-900 p-16 text-center">

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center border border-slate-700 bg-slate-950 text-2xl">
              ✓
            </div>

            <h2 className="text-xl font-semibold">
              No Upcoming Maintenance
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              There are currently no pending or scheduled
              maintenance records for your properties.
            </p>

            <Link
              href="/dashboard/maintenance/add"
              className="mt-7 inline-block border border-slate-700 px-6 py-3 text-sm font-medium transition hover:bg-slate-800"
            >
              Add Maintenance
            </Link>

          </div>

        ) : (

          /* Records */

          <section className="border border-slate-800 bg-slate-900">

            <div className="border-b border-slate-800 px-6 py-5 sm:px-8">

              <h2 className="text-lg font-semibold">
                Scheduled Maintenance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {sortedRecords.length} upcoming record
                {sortedRecords.length !==
                1
                  ? "s"
                  : ""}
              </p>

            </div>

            <div className="divide-y divide-slate-800">

              {sortedRecords.map(
                (record) => {

                  const daysRemaining =
                    getDaysRemaining(
                      record.maintenanceDate
                    );

                  return (
                    <div
                      key={
                        record.$id
                      }
                      className="p-6 transition hover:bg-slate-800/40 sm:p-8"
                    >

                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                        {/* Main Information */}

                        <div className="flex gap-4">

                          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-slate-700 bg-slate-950 text-xl">
                            {getCategoryIcon(
                              record.category
                            )}
                          </div>

                          <div>

                            <div className="flex flex-wrap items-center gap-3">

                              <h3 className="text-lg font-semibold">
                                {record.title}
                              </h3>

                              <span
                                className={`border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusClass(
                                  record.status
                                )}`}
                              >
                                {record.status ===
                                "InProgress"
                                  ? "In Progress"
                                  : record.status}
                              </span>

                            </div>

                            <p className="mt-1 text-sm text-blue-400">
                              {getPropertyName(
                                record.propertyId
                              )}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {record.category}
                            </p>

                            {record.description && (
                              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                                {
                                  record.description
                                }
                              </p>
                            )}

                            {record.providerName && (
                              <p className="mt-3 text-sm text-slate-400">

                                <span className="text-slate-500">
                                  Provider:
                                </span>{" "}

                                {
                                  record.providerName
                                }

                              </p>
                            )}

                          </div>

                        </div>

                        {/* Date / Cost / Action */}

                        <div className="grid gap-5 sm:grid-cols-3 lg:min-w-[430px]">

                          <div>

                            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                              Date
                            </p>

                            <p className="mt-2 text-sm font-medium">
                              {formatDate(
                                record.maintenanceDate
                              )}
                            </p>

                            <p
                              className={`mt-1 text-xs ${
                                daysRemaining <=
                                3
                                  ? "text-amber-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {daysRemaining ===
                              0
                                ? "Today"
                                : daysRemaining ===
                                  1
                                ? "Tomorrow"
                                : `${daysRemaining} days remaining`}
                            </p>

                          </div>

                          <div>

                            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                              Cost
                            </p>

                            <p className="mt-2 text-sm font-semibold">

                              ₹
                              {Number(
                                record.cost ||
                                  0
                              ).toLocaleString(
                                "en-IN"
                              )}

                            </p>

                          </div>

                          <div className="sm:text-right">

                            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                              Action
                            </p>

                            <Link
                              href={`/dashboard/maintenance/${record.$id}`}
                              onClick={() =>
                                setSelectedMaintenanceId(
                                  record.$id
                                )
                              }
                              className="mt-2 inline-block border border-slate-700 px-4 py-2 text-xs font-medium transition hover:bg-slate-800"
                            >
                              View Details
                            </Link>

                          </div>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </section>
        )}

        {/* Footer */}

        <div className="mt-8 border border-slate-800 bg-slate-900/50 p-5">

          <p className="text-xs leading-5 text-slate-500">
            Upcoming maintenance includes records scheduled
            for today or a future date that have not been
            completed or cancelled.
          </p>

        </div>

      </div>

    </main>
  );
}