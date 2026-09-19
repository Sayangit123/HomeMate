"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Swal from "sweetalert2";

import { getCurrentUser } from "@/lib/appwrite/account";
import {
  createProperty,
  CreatePropertyData,
} from "@/lib/appwrite/property";
import { uploadPropertyImage } from "@/lib/appwrite/storage";

type PropertyType =
  | "Apartment"
  | "House"
  | "Office"
  | "Villa"
  | "Other";

interface PropertyFormData {
  propertyName: string;
  propertyType: PropertyType;
  address: string;
  location: string;
  rooms: string;
  appliances: string;
}

const propertySchema = yup.object({
  propertyName: yup
    .string()
    .required("Property name is required")
    .min(2, "Property name must be at least 2 characters")
    .max(100, "Property name must not exceed 100 characters"),

  propertyType: yup
    .mixed<PropertyType>()
    .oneOf(
      ["Apartment", "House", "Office", "Villa", "Other"],
      "Please select a property type"
    )
    .required("Property type is required"),

  address: yup
    .string()
    .required("Address is required")
    .min(5, "Please enter a complete address")
    .max(255, "Address must not exceed 255 characters"),

  location: yup
    .string()
    .max(255, "Location must not exceed 255 characters")
    .default(""),

  rooms: yup
    .string()
    .max(200, "Rooms information must not exceed 200 characters")
    .default(""),

  appliances: yup
    .string()
    .max(400, "Appliances information must not exceed 400 characters")
    .default(""),
});

export default function AddPropertyPage() {
  const [propertyImages, setPropertyImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PropertyFormData>({
    resolver: yupResolver(propertySchema),
    defaultValues: {
      propertyName: "",
      propertyType: undefined,
      address: "",
      location: "",
      rooms: "",
      appliances: "",
    },
  });

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);

    if (files.length > 5) {
      Swal.fire({
        icon: "warning",
        title: "Too many images",
        text: "You can upload a maximum of 5 property images.",
        confirmButtonColor: "#0f172a",
      });

      event.target.value = "";
      return;
    }

    const invalidFile = files.find(
      (file) =>
        ![
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/webp",
        ].includes(file.type)
    );

    if (invalidFile) {
      Swal.fire({
        icon: "error",
        title: "Invalid image",
        text: "Only PNG, JPG, JPEG and WEBP images are allowed.",
        confirmButtonColor: "#0f172a",
      });

      event.target.value = "";
      return;
    }

    const oversizedFile = files.find(
      (file) => file.size > 10 * 1024 * 1024
    );

    if (oversizedFile) {
      Swal.fire({
        icon: "error",
        title: "Image too large",
        text: "Each property image must be 10 MB or smaller.",
        confirmButtonColor: "#0f172a",
      });

      event.target.value = "";
      return;
    }

    setPropertyImages(files);
  };

  const onSubmit = async (data: PropertyFormData) => {
    try {
      setIsSubmitting(true);

      // Get currently logged-in Appwrite user
      const user = await getCurrentUser();

      if (!user) {
        throw new Error(
          "You must be logged in to add a property."
        );
      }

      // Upload property images
      const uploadedImageIds: string[] = [];

      for (const file of propertyImages) {
        const uploadedFile = await uploadPropertyImage(file);

        uploadedImageIds.push(uploadedFile.$id);
      }

      // Prepare property data
      const propertyData: CreatePropertyData = {
        userId: user.$id,
        propertyName: data.propertyName,
        propertyType: data.propertyType,
        address: data.address,
        location: data.location || null,

        propertyImages:
          uploadedImageIds.length > 0
            ? JSON.stringify(uploadedImageIds)
            : null,

        rooms: data.rooms || null,
        appliances: data.appliances || null,

        maintenanceHistory: null,
        upcomingMaintenance: null,
      };

      // Create property in Appwrite
      await createProperty(propertyData);

      await Swal.fire({
        icon: "success",
        title: "Property Added",
        text: "Your property has been added successfully.",
        confirmButtonColor: "#0f172a",
      });

      // Reset form
      reset();

      setPropertyImages([]);

      // Clear file input
      const fileInput = document.getElementById(
        "propertyImages"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error: unknown) {
      console.error("Add property error:", error);

      let message =
        "Something went wrong while adding your property.";

      if (error instanceof Error) {
        message = error.message;
      }

      await Swal.fire({
        icon: "error",
        title: "Unable to Add Property",
        text: message,
        confirmButtonColor: "#0f172a",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}

        <div className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
            Property Management
          </p>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Add New Property
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Add your property details to manage it through
            HomeMate.
          </p>
        </div>

        {/* Form */}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-8"
        >
          {/* Basic Information */}

          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Basic Information
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Enter the basic details of your property.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Property Name */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Property Name
                </label>

                <input
                  type="text"
                  placeholder="e.g. My Home"
                  {...register("propertyName")}
                  className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
                />

                {errors.propertyName && (
                  <p className="mt-2 text-xs text-red-400">
                    {errors.propertyName.message}
                  </p>
                )}
              </div>

              {/* Property Type */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Property Type
                </label>

                <select
                  {...register("propertyType")}
                  className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
                >
                  <option value="">
                    Select property type
                  </option>
                  <option value="Apartment">
                    Apartment
                  </option>
                  <option value="House">House</option>
                  <option value="Office">Office</option>
                  <option value="Villa">Villa</option>
                  <option value="Other">Other</option>
                </select>

                {errors.propertyType && (
                  <p className="mt-2 text-xs text-red-400">
                    {errors.propertyType.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Address & Location */}

          <section className="mt-10 border-t border-slate-800 pt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Address & Location
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Provide the property address and location
                details.
              </p>
            </div>

            <div className="space-y-6">
              {/* Address */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Address
                </label>

                <textarea
                  rows={3}
                  placeholder="Enter complete property address"
                  {...register("address")}
                  className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
                />

                {errors.address && (
                  <p className="mt-2 text-xs text-red-400">
                    {errors.address.message}
                  </p>
                )}
              </div>

              {/* Location */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Location
                  <span className="ml-2 text-xs text-slate-500">
                    Optional
                  </span>
                </label>

                <input
                  type="text"
                  placeholder="e.g. Kestopur, Kolkata"
                  {...register("location")}
                  className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
                />

                {errors.location && (
                  <p className="mt-2 text-xs text-red-400">
                    {errors.location.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Property Images */}

          <section className="mt-10 border-t border-slate-800 pt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Property Images
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Upload images of your property.
              </p>
            </div>

            <div className="border border-dashed border-slate-700 bg-slate-950 p-6">
              <input
                id="propertyImages"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                onChange={handleImageChange}
                className="block w-full text-sm text-slate-400 file:mr-4 file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-slate-700"
              />

              <p className="mt-3 text-xs text-slate-500">
                PNG, JPG, JPEG or WEBP. Maximum 5 images.
                Maximum 10 MB per image.
              </p>

              {propertyImages.length > 0 && (
                <p className="mt-3 text-sm text-slate-300">
                  {propertyImages.length} image
                  {propertyImages.length > 1 ? "s" : ""}{" "}
                  selected
                </p>
              )}
            </div>
          </section>

          {/* Rooms */}

          <section className="mt-10 border-t border-slate-800 pt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Rooms & Areas
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Add the rooms or important areas of the
                property.
              </p>
            </div>

            <textarea
              rows={3}
              placeholder="e.g. 2 Bedrooms, 1 Kitchen, 1 Living Room, 2 Bathrooms"
              {...register("rooms")}
              className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
            />

            {errors.rooms && (
              <p className="mt-2 text-xs text-red-400">
                {errors.rooms.message}
              </p>
            )}
          </section>

          {/* Appliances */}

          <section className="mt-10 border-t border-slate-800 pt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Appliances
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Add appliances available in the property.
              </p>
            </div>

            <textarea
              rows={3}
              placeholder="e.g. AC, Refrigerator, Washing Machine, Microwave"
              {...register("appliances")}
              className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
            />

            {errors.appliances && (
              <p className="mt-2 text-xs text-red-400">
                {errors.appliances.message}
              </p>
            )}
          </section>

          {/* Submit */}

          <div className="mt-10 flex justify-end border-t border-slate-800 pt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="border border-slate-600 bg-white px-8 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Adding Property..."
                : "Add Property"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}