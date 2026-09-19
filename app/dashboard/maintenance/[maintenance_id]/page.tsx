"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { getCurrentUser } from "@/lib/appwrite/account";
import { getPropertyById } from "@/lib/appwrite/property";
import {
  deleteMaintenance,
  getMaintenanceById,
  MaintenanceStatus,
} from "@/lib/appwrite/maintenance";

interface MaintenanceRecord {
  $id: string;
  userId: string;
  propertyId: string;
  title: string;
  category: string;
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
  address: string;
  propertyType?: string;
}

export default function MaintenanceDetailsPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const [maintenance, setMaintenance] =
    useState<MaintenanceRecord | null>(null);

  const [property, setProperty] =
    useState<Property | null>(null);

  const [loading, setLoading] = useState(true);

  // Get ID from params first
  let maintenanceId = "";

  if (typeof params?.maintenanceId === "string") {
    maintenanceId = params.maintenanceId;
  } else if (Array.isArray(params?.maintenanceId)) {
    maintenanceId = params.maintenanceId[0] || "";
  }

  // Fallback: get ID directly from URL pathname
  if (!maintenanceId && pathname) {
    const parts = pathname.split("/").filter(Boolean);

    const maintenanceIndex =
      parts.indexOf("maintenance");

    if (maintenanceIndex !== -1) {
      maintenanceId =
        parts[maintenanceIndex + 1] || "";
    }
  }

  useEffect(() => {
    const loadDetails = async () => {
      if (!maintenanceId) {
        return;
      }

      try {
        setLoading(true);

        console.log(
          "Loading maintenance ID:",
          maintenanceId
        );

        const user = await getCurrentUser();

        const record = (await getMaintenanceById(
          maintenanceId
        )) as unknown as MaintenanceRecord;

        console.log(
          "Maintenance record:",
          record
        );

        // Ownership check
        if (record.userId !== user.$id) {
          await Swal.fire({
            icon: "error",
            title: "Access denied",
            text: "You are not authorized to view this maintenance record.",
          });

          router.push("/dashboard/maintenance");
          return;
        }

        setMaintenance(record);

        // Load related property
        try {
          const propertyData = (await getPropertyById(
            record.propertyId
          )) as unknown as Property;

          console.log(
            "Property:",
            propertyData
          );

          setProperty(propertyData);
        } catch (propertyError) {
          console.error(
            "Failed to load property:",
            propertyError
          );
        }
      } catch (error) {
        console.error(
          "Failed to load maintenance details:",
          error
        );

        await Swal.fire({
          icon: "error",
          title: "Unable to load record",
          text: "The maintenance record could not be found.",
        });

        router.push("/dashboard/maintenance");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [maintenanceId, router]);

  const formatDate = (date: string) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatCost = (cost?: number | null) => {
    return `₹${Number(cost || 0).toLocaleString(
      "en-IN"
    )}`;
  };

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

  const handleDelete = async () => {
    if (!maintenance) return;

    const result = await Swal.fire({
      icon: "warning",
      title: "Delete maintenance record?",
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteMaintenance(maintenance.$id);

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: "Maintenance record deleted successfully.",
        timer: 1500,
        showConfirmButton: false,
      });

      router.push("/dashboard/maintenance");
    } catch (error) {
      console.error(
        "Failed to delete maintenance:",
        error
      );

      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: "Unable to delete this maintenance record.",
      });
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex min-h-[70vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin border-2 border-slate-700 border-t-blue-500" />

              <p className="text-sm text-slate-400">
                Loading maintenance details...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!maintenance) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        {/* Back */}
        <button
          type="button"
          onClick={() =>
            router.push("/dashboard/maintenance")
          }
          className="mb-6 text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Maintenance
        </button>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 border-b border-slate-800 pb-7 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-blue-400">
              MAINTENANCE RECORD
            </p>

            <h1 className="text-3xl font-bold">
              {maintenance.title}
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              {property?.propertyName || "Property"}
            </p>
          </div>

          <span
            className={`w-fit border px-4 py-2 text-sm font-medium ${getStatusClass(
              maintenance.status
            )}`}
          >
            {maintenance.status}
          </span>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Maintenance Information */}
          <section className="border border-slate-800 bg-slate-900 lg:col-span-2">
            <div className="border-b border-slate-800 px-6 py-5">
              <h2 className="text-lg font-semibold">
                Maintenance Information
              </h2>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2">

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Title
                </p>

                <p className="mt-2 text-sm font-medium text-white">
                  {maintenance.title}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Category
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  {maintenance.category}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Maintenance Date
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  {formatDate(
                    maintenance.maintenanceDate
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Cost
                </p>

                <p className="mt-2 text-lg font-semibold text-white">
                  {formatCost(maintenance.cost)}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Service Provider
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  {maintenance.providerName ||
                    "Not provided"}
                </p>
              </div>

            </div>
          </section>

          {/* Property */}
          <section className="border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-5">
              <h2 className="text-lg font-semibold">
                Property
              </h2>
            </div>

            <div className="p-6">

              <div className="mb-5 flex h-12 w-12 items-center justify-center border border-blue-500/30 bg-blue-500/10 text-xl">
                🏠
              </div>

              <h3 className="font-semibold text-white">
                {property?.propertyName ||
                  "Unknown Property"}
              </h3>

              {property?.propertyType && (
                <p className="mt-1 text-xs text-blue-400">
                  {property.propertyType}
                </p>
              )}

              <p className="mt-4 text-sm leading-6 text-slate-400">
                {property?.address ||
                  "Property address unavailable"}
              </p>

              {property && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/dashboard/properties/${property.$id}`
                    )
                  }
                  className="mt-5 w-full border border-slate-700 px-4 py-3 text-xs font-medium text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                >
                  View Property
                </button>
              )}

            </div>
          </section>

          {/* Description */}
          <section className="border border-slate-800 bg-slate-900 lg:col-span-3">
            <div className="border-b border-slate-800 px-6 py-5">
              <h2 className="text-lg font-semibold">
                Description
              </h2>
            </div>

            <div className="p-6">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {maintenance.description ||
                  "No description provided."}
              </p>
            </div>
          </section>

          {/* Notes */}
          <section className="border border-slate-800 bg-slate-900 lg:col-span-3">
            <div className="border-b border-slate-800 px-6 py-5">
              <h2 className="text-lg font-semibold">
                Notes
              </h2>
            </div>

            <div className="p-6">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {maintenance.notes ||
                  "No additional notes."}
              </p>
            </div>
          </section>

        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">

          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/maintenance/${maintenance.$id}/edit`
              )
            }
            className="border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-amber-500 hover:text-amber-400"
          >
            Edit Maintenance
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="border border-red-500/30 px-6 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Delete Maintenance
          </button>

        </div>

      </div>
    </main>
  );
}