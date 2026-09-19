"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Swal from "sweetalert2";

import {
  createMaintenance,
  MaintenanceCategory,
  MaintenanceStatus,
} from "@/lib/appwrite/maintenance";

import { getCurrentUser } from "@/lib/appwrite/account";
import { getUserProperties } from "@/lib/appwrite/property";

interface Property {
  $id: string;
  propertyName: string;
  address: string;
}

interface MaintenanceFormData {
  propertyId: string;
  title: string;
  category: MaintenanceCategory;
  description: string;
  maintenanceDate: string;
  status: MaintenanceStatus;
  cost: number;
  providerName: string;
  notes: string;
}

const maintenanceSchema = yup.object({
  propertyId: yup
    .string()
    .required("Please select a property"),

  title: yup
    .string()
    .required("Maintenance title is required")
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must not exceed 100 characters"),

  category: yup
    .mixed<MaintenanceCategory>()
    .oneOf(
      [
        "General",
        "Electrical",
        "Plumbing",
        "Cleaning",
        "AC",
        "Appliance",
        "Painting",
        "Pest Control",
        "Other",
      ],
      "Please select a valid category"
    )
    .required("Category is required"),

  description: yup
    .string()
    .max(1000, "Description must not exceed 1000 characters")
    .default(""),

  maintenanceDate: yup
    .string()
    .required("Maintenance date is required"),

  status: yup
    .mixed<MaintenanceStatus>()
    .oneOf(
      ["Pending", "InProgress", "Completed", "Cancelled"],
      "Please select a valid status"
    )
    .required("Status is required"),

  cost: yup
    .number()
    .typeError("Cost must be a number")
    .min(0, "Cost cannot be negative")
    .default(0),

  providerName: yup
    .string()
    .max(100, "Provider name must not exceed 100 characters")
    .default(""),

  notes: yup
    .string()
    .max(1000, "Notes must not exceed 1000 characters")
    .default(""),
});

export default function AddMaintenancePage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MaintenanceFormData>({
    resolver: yupResolver(maintenanceSchema),
    defaultValues: {
      propertyId: "",
      title: "",
      category: "General",
      description: "",
      maintenanceDate: "",
      status: "Pending",
      cost: 0,
      providerName: "",
      notes: "",
    },
  });

  useEffect(() => {
    const loadProperties = async () => {
      try {
        const user = await getCurrentUser();

        const response = await getUserProperties(user.$id);

        setProperties(response.documents as unknown as Property[]);
      } catch (error) {
        console.error("Failed to load properties:", error);

        Swal.fire({
          icon: "error",
          title: "Unable to load properties",
          text: "Please refresh the page and try again.",
        });
      } finally {
        setLoadingProperties(false);
      }
    };

    loadProperties();
  }, []);

  const onSubmit = async (data: MaintenanceFormData) => {
    try {
      setSubmitting(true);

      const user = await getCurrentUser();

      await createMaintenance({
        userId: user.$id,
        propertyId: data.propertyId,
        title: data.title,
        category: data.category,
        description: data.description || null,
        maintenanceDate: data.maintenanceDate,
        status: data.status,
        cost: Number(data.cost) || 0,
        providerName: data.providerName || null,
        notes: data.notes || null,
      });

      await Swal.fire({
        icon: "success",
        title: "Maintenance Added",
        text: "The maintenance record has been created successfully.",
        confirmButtonText: "Continue",
      });

      router.push("/dashboard/maintenance");
    } catch (error) {
      console.error("Failed to create maintenance:", error);

      Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: "Unable to create the maintenance record. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/dashboard/maintenance")}
            className="mb-5 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Maintenance
          </button>

          <h1 className="text-3xl font-bold">
            Add Maintenance
          </h1>

          <p className="mt-2 text-slate-400">
            Create a maintenance record for one of your properties.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="border border-slate-800 bg-slate-900 p-8 shadow-xl"
        >
          {/* Property */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Property
            </label>

            <select
              {...register("propertyId")}
              disabled={loadingProperties}
              className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {loadingProperties
                  ? "Loading properties..."
                  : "Select a property"}
              </option>

              {properties.map((property) => (
                <option key={property.$id} value={property.$id}>
                  {property.propertyName} — {property.address}
                </option>
              ))}
            </select>

            {errors.propertyId && (
              <p className="mt-2 text-sm text-red-400">
                {errors.propertyId.message}
              </p>
            )}

            {!loadingProperties && properties.length === 0 && (
              <p className="mt-2 text-sm text-amber-400">
                You do not have any properties yet. Add a property first.
              </p>
            )}
          </div>

          {/* Title + Category */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Maintenance Title
              </label>

              <input
                type="text"
                placeholder="e.g. AC servicing"
                {...register("title")}
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500"
              />

              {errors.title && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Category
              </label>

              <select
                {...register("category")}
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="General">General</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Cleaning">Cleaning</option>
                <option value="AC">AC</option>
                <option value="Appliance">Appliance</option>
                <option value="Painting">Painting</option>
                <option value="Pest Control">Pest Control</option>
                <option value="Other">Other</option>
              </select>

              {errors.category && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.category.message}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Description
            </label>

            <textarea
              rows={4}
              placeholder="Describe the maintenance work..."
              {...register("description")}
              className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500"
            />

            {errors.description && (
              <p className="mt-2 text-sm text-red-400">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Date + Status + Cost */}
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Maintenance Date
              </label>

              <input
                type="date"
                {...register("maintenanceDate")}
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              />

              {errors.maintenanceDate && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.maintenanceDate.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Status
              </label>

              <select
                {...register("status")}
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              {errors.status && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.status.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Cost
              </label>

              <input
                type="number"
                min="0"
                placeholder="0"
                {...register("cost", {
                  valueAsNumber: true,
                })}
                className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500"
              />

              {errors.cost && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.cost.message}
                </p>
              )}
            </div>
          </div>

          {/* Provider */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Service Provider
            </label>

            <input
              type="text"
              placeholder="e.g. ABC Electrical Services"
              {...register("providerName")}
              className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500"
            />

            {errors.providerName && (
              <p className="mt-2 text-sm text-red-400">
                {errors.providerName.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Notes
            </label>

            <textarea
              rows={4}
              placeholder="Additional notes..."
              {...register("notes")}
              className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500"
            />

            {errors.notes && (
              <p className="mt-2 text-sm text-red-400">
                {errors.notes.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.push("/dashboard/maintenance")
              }
              disabled={submitting}
              className="border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || properties.length === 0}
              className="bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : "Add Maintenance"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}