"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";

import { getCurrentUser } from "@/lib/appwrite/account";

import {
  getPropertyById,
  updateProperty,
} from "@/lib/appwrite/property";

import {
  uploadPropertyImage,
  getPropertyImageUrl,
  deletePropertyImage,
} from "@/lib/appwrite/storage";

interface Property {
  $id: string;
  userId: string;

  propertyName: string;

  propertyType:
    | "Apartment"
    | "House"
    | "Office"
    | "Villa"
    | "Other";

  address: string;

  location: string | null;

  propertyImages: string | null;

  rooms: string | null;

  appliances: string | null;

  maintenanceHistory: string | null;

  upcomingMaintenance: string | null;
}

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();

  // ==========================================
  // PROPERTY ID
  // ==========================================

  const [propertyId, setPropertyId] =
    useState<string | null>(null);

  // ==========================================
  // STATES
  // ==========================================

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [property, setProperty] =
    useState<Property | null>(null);

  // Existing Appwrite file IDs
  const [existingImages, setExistingImages] =
    useState<string[]>([]);

  // Generated Appwrite image URLs
  const [existingImageUrls, setExistingImageUrls] =
    useState<Record<string, string>>({});

  // Newly selected files
  const [newImages, setNewImages] =
    useState<File[]>([]);

  // Preview URLs for new files
  const [newImagePreviews, setNewImagePreviews] =
    useState<string[]>([]);

  // ==========================================
  // FORM DATA
  // ==========================================

  const [formData, setFormData] =
    useState({
      propertyName: "",

      propertyType:
        "Apartment" as Property["propertyType"],

      address: "",

      location: "",

      rooms: "",

      appliances: "",

      maintenanceHistory: "",

      upcomingMaintenance: "",
    });

  // ==========================================
  // GET PROPERTY ID
  // ==========================================

  useEffect(() => {
    let id: string | null = null;

    // First try Next.js params
    if (params?.propertyId) {
      if (
        Array.isArray(params.propertyId)
      ) {
        id = params.propertyId[0];
      } else {
        id = params.propertyId;
      }
    }

    // Fallback to URL
    if (
      !id &&
      typeof window !== "undefined"
    ) {
      const parts =
        window.location.pathname
          .split("/")
          .filter(Boolean);

      const propertiesIndex =
        parts.indexOf("properties");

      if (
        propertiesIndex !== -1 &&
        parts[propertiesIndex + 1] &&
        parts[propertiesIndex + 1] !== "add"
      ) {
        id =
          parts[
            propertiesIndex + 1
          ];
      }
    }

    if (!id) {
      console.error(
        "Property ID is missing from URL."
      );

      Swal.fire({
        icon: "error",
        title: "Property ID Missing",
        text: "Unable to identify the property.",
        confirmButtonColor: "#020617",
      }).then(() => {
        router.push(
          "/dashboard/properties"
        );
      });

      return;
    }

    console.log(
      "EDIT PROPERTY ID:",
      id
    );

    setPropertyId(id);
  }, [params, router]);

  // ==========================================
  // PARSE PROPERTY IMAGE IDS
  // ==========================================

  const parsePropertyImageIds = (
    value: string | null
  ): string[] => {
    if (!value) {
      return [];
    }

    const trimmedValue =
      value.trim();

    if (!trimmedValue) {
      return [];
    }

    // ------------------------------------------
    // NEW FORMAT
    // ["fileId1","fileId2"]
    // ------------------------------------------

    if (
      trimmedValue.startsWith("[") &&
      trimmedValue.endsWith("]")
    ) {
      try {
        const parsed =
          JSON.parse(trimmedValue);

        if (Array.isArray(parsed)) {
          return parsed
            .map((id) =>
              String(id)
                .trim()
                .replace(/^["']|["']$/g, "")
            )
            .filter(Boolean);
        }
      } catch (error) {
        console.error(
          "JSON image parsing failed:",
          error
        );
      }
    }

    // ------------------------------------------
    // OLD FORMAT
    // fileId1,fileId2
    // ------------------------------------------

    return trimmedValue
      .split(",")
      .map((id) =>
        id
          .trim()
          .replace(/^["[\]]+|["[\]]+$/g, "")
      )
      .filter(Boolean);
  };

  // ==========================================
  // LOAD PROPERTY
  // ==========================================

  useEffect(() => {
    if (!propertyId) {
      return;
    }

    const loadProperty =
      async () => {
        try {
          setLoading(true);

          console.log(
            "EDIT PAGE - Loading property:",
            propertyId
          );

          // --------------------------------------
          // CURRENT USER
          // --------------------------------------

          const user =
            await getCurrentUser();

          if (!user) {
            router.push("/login");
            return;
          }

          // --------------------------------------
          // PROPERTY
          // --------------------------------------

          const data =
            (await getPropertyById(
              propertyId
            )) as unknown as Property;

          console.log(
            "EDIT PAGE - PROPERTY DATA:",
            data
          );

          if (!data) {
            throw new Error(
              "Property not found."
            );
          }

          // --------------------------------------
          // OWNERSHIP CHECK
          // --------------------------------------

          if (
            data.userId !== user.$id
          ) {
            await Swal.fire({
              icon: "error",
              title: "Access Denied",
              text: "You do not have permission to edit this property.",
              confirmButtonColor:
                "#020617",
            });

            router.push(
              "/dashboard/properties"
            );

            return;
          }

          setProperty(data);

          // --------------------------------------
          // FORM VALUES
          // --------------------------------------

          setFormData({
            propertyName:
              data.propertyName || "",

            propertyType:
              data.propertyType ||
              "Apartment",

            address:
              data.address || "",

            location:
              data.location || "",

            rooms:
              data.rooms || "",

            appliances:
              data.appliances || "",

            maintenanceHistory:
              data.maintenanceHistory ||
              "",

            upcomingMaintenance:
              data.upcomingMaintenance ||
              "",
          });

          // --------------------------------------
          // PROPERTY IMAGES
          // --------------------------------------

          const imageIds =
            parsePropertyImageIds(
              data.propertyImages
            );

          console.log(
            "CLEAN PROPERTY IMAGE IDS:",
            imageIds
          );

          setExistingImages(
            imageIds
          );

          // --------------------------------------
          // GENERATE APPWRITE IMAGE URLS
          // --------------------------------------

          const imageUrlMap: Record<
            string,
            string
          > = {};

          imageIds.forEach(
            (fileId) => {
              try {
                const url =
                  getPropertyImageUrl(
                    fileId
                  );

                const urlString =
                  url.toString();

                console.log(
                  "PROPERTY IMAGE URL:",
                  fileId,
                  urlString
                );

                imageUrlMap[
                  fileId
                ] = urlString;
              } catch (error) {
                console.error(
                  "Failed to generate property image URL:",
                  fileId,
                  error
                );
              }
            }
          );

          setExistingImageUrls(
            imageUrlMap
          );
        } catch (error: unknown) {
          console.error(
            "Load edit property error:",
            error
          );

          let message =
            "Unable to load property.";

          if (
            error instanceof Error
          ) {
            message =
              error.message;
          }

          await Swal.fire({
            icon: "error",
            title: "Property Not Found",
            text: message,
            confirmButtonColor:
              "#020617",
          });

          router.push(
            "/dashboard/properties"
          );
        } finally {
          setLoading(false);
        }
      };

    loadProperty();
  }, [propertyId, router]);

  // ==========================================
  // HANDLE INPUT CHANGE
  // ==========================================

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement |
        HTMLTextAreaElement |
        HTMLSelectElement
    >
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  // ==========================================
  // HANDLE NEW IMAGE SELECTION
  // ==========================================

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files =
      Array.from(
        event.target.files || []
      );

    if (files.length === 0) {
      return;
    }

    // ------------------------------------------
    // ALLOWED FILE TYPES
    // ------------------------------------------

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    const invalidFile =
      files.find(
        (file) =>
          !allowedTypes.includes(
            file.type
          )
      );

    if (invalidFile) {
      Swal.fire({
        icon: "error",
        title: "Invalid Image",
        text: "Only JPG, JPEG, PNG and WEBP images are allowed.",
        confirmButtonColor:
          "#020617",
      });

      event.target.value = "";

      return;
    }

    // ------------------------------------------
    // MAXIMUM 5 IMAGES
    // ------------------------------------------

    const totalImages =
      existingImages.length +
      newImages.length +
      files.length;

    if (totalImages > 5) {
      Swal.fire({
        icon: "warning",
        title: "Maximum 5 Images",
        text: "A property can have a maximum of 5 images.",
        confirmButtonColor:
          "#020617",
      });

      event.target.value = "";

      return;
    }

    // ------------------------------------------
    // MAXIMUM 10 MB
    // ------------------------------------------

    const oversizedFile =
      files.find(
        (file) =>
          file.size >
          10 * 1024 * 1024
      );

    if (oversizedFile) {
      Swal.fire({
        icon: "error",
        title: "File Too Large",
        text: "Each image must be smaller than 10 MB.",
        confirmButtonColor:
          "#020617",
      });

      event.target.value = "";

      return;
    }

    // ------------------------------------------
    // SAVE FILES
    // ------------------------------------------

    setNewImages(
      (previous) => [
        ...previous,
        ...files,
      ]
    );

    // ------------------------------------------
    // CREATE PREVIEWS
    // ------------------------------------------

    const previews =
      files.map(
        (file) =>
          URL.createObjectURL(
            file
          )
      );

    setNewImagePreviews(
      (previous) => [
        ...previous,
        ...previews,
      ]
    );

    event.target.value = "";
  };

  // ==========================================
  // REMOVE NEW IMAGE
  // ==========================================

  const removeNewImage = (
    index: number
  ) => {
    setNewImages(
      (previous) =>
        previous.filter(
          (_, imageIndex) =>
            imageIndex !== index
        )
    );

    setNewImagePreviews(
      (previous) => {
        const preview =
          previous[index];

        if (preview) {
          URL.revokeObjectURL(
            preview
          );
        }

        return previous.filter(
          (_, imageIndex) =>
            imageIndex !== index
        );
      }
    );
  };

  // ==========================================
  // REMOVE EXISTING IMAGE
  // ==========================================

  const removeExistingImage =
    async (
      fileId: string
    ) => {
      const result =
        await Swal.fire({
          icon: "warning",
          title: "Remove Image?",
          text: "This image will be removed from the property.",
          showCancelButton: true,
          confirmButtonText:
            "Remove",
          cancelButtonText:
            "Cancel",
          confirmButtonColor:
            "#dc2626",
        });

      if (
        !result.isConfirmed
      ) {
        return;
      }

      try {
        // --------------------------------------
        // DELETE FROM APPWRITE STORAGE
        // --------------------------------------

        await deletePropertyImage(
          fileId
        );

        // --------------------------------------
        // REMOVE FROM LOCAL STATE
        // --------------------------------------

        const updatedImages =
          existingImages.filter(
            (id) =>
              id !== fileId
          );

        setExistingImages(
          updatedImages
        );

        setExistingImageUrls(
          (previous) => {
            const updated = {
              ...previous,
            };

            delete updated[
              fileId
            ];

            return updated;
          }
        );

        // --------------------------------------
        // SAVE UPDATED IMAGE LIST
        // --------------------------------------

        if (property) {
          const imageValue =
            updatedImages.length >
            0
              ? JSON.stringify(
                  updatedImages
                )
              : null;

          await updateProperty(
            property.$id,
            {
              propertyImages:
                imageValue,
            }
          );

          setProperty({
            ...property,

            propertyImages:
              imageValue,
          });
        }

        await Swal.fire({
          icon: "success",
          title: "Image Removed",
          text: "The property image has been removed.",
          confirmButtonColor:
            "#020617",
        });
      } catch (error: unknown) {
        console.error(
          "Remove property image error:",
          error
        );

        let message =
          "Unable to remove the image.";

        if (
          error instanceof Error
        ) {
          message =
            error.message;
        }

        await Swal.fire({
          icon: "error",
          title: "Failed",
          text: message,
          confirmButtonColor:
            "#020617",
        });
      }
    };

  // ==========================================
  // UPDATE PROPERTY
  // ==========================================

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !property ||
      !propertyId
    ) {
      return;
    }

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (
      !formData.propertyName.trim()
    ) {
      await Swal.fire({
        icon: "warning",
        title:
          "Property Name Required",
        text: "Please enter a property name.",
        confirmButtonColor:
          "#020617",
      });

      return;
    }

    if (
      !formData.address.trim()
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Address Required",
        text: "Please enter a property address.",
        confirmButtonColor:
          "#020617",
      });

      return;
    }

    try {
      setSaving(true);

      // ------------------------------------------
      // UPLOAD NEW IMAGES
      // ------------------------------------------

      const uploadedImageIds: string[] =
        [];

      for (
        const file of newImages
      ) {
        console.log(
          "Uploading new property image:",
          file.name
        );

        const uploaded =
          await uploadPropertyImage(
            file
          );

        console.log(
          "Uploaded property image:",
          uploaded.$id
        );

        uploadedImageIds.push(
          uploaded.$id
        );
      }

      // ------------------------------------------
      // COMBINE EXISTING + NEW
      // ------------------------------------------

      const allImageIds = [
        ...existingImages,
        ...uploadedImageIds,
      ];

      console.log(
        "FINAL PROPERTY IMAGE IDS:",
        allImageIds
      );

      // ------------------------------------------
      // IMPORTANT
      // Store image IDs as JSON
      // ------------------------------------------

      const propertyImagesValue =
        allImageIds.length > 0
          ? JSON.stringify(
              allImageIds
            )
          : null;

      console.log(
        "FINAL PROPERTY IMAGES VALUE:",
        propertyImagesValue
      );

      // ------------------------------------------
      // UPDATE PROPERTY
      // ------------------------------------------

      await updateProperty(
        propertyId,
        {
          propertyName:
            formData.propertyName.trim(),

          propertyType:
            formData.propertyType,

          address:
            formData.address.trim(),

          location:
            formData.location.trim() ||
            null,

          propertyImages:
            propertyImagesValue,

          rooms:
            formData.rooms.trim() ||
            null,

          appliances:
            formData.appliances.trim() ||
            null,

          maintenanceHistory:
            formData.maintenanceHistory.trim() ||
            null,

          upcomingMaintenance:
            formData.upcomingMaintenance.trim() ||
            null,
        }
      );

      // ------------------------------------------
      // SUCCESS
      // ------------------------------------------

      await Swal.fire({
        icon: "success",
        title: "Property Updated",
        text: "Your property has been updated successfully.",
        confirmButtonColor:
          "#020617",
      });

      router.push(
        "/dashboard/properties"
      );

      router.refresh();
    } catch (error: unknown) {
      console.error(
        "Update property error:",
        error
      );

      let message =
        "Unable to update the property.";

      if (
        error instanceof Error
      ) {
        message =
          error.message;
      }

      await Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: message,
        confirmButtonColor:
          "#020617",
      });
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="border border-slate-800 bg-slate-900 p-12 text-center">
            <p className="text-sm text-slate-400">
              Loading property...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // PROPERTY NOT FOUND
  // ==========================================

  if (!property) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="border border-slate-800 bg-slate-900 p-12 text-center">
            <h1 className="text-xl font-semibold">
              Property Not Found
            </h1>

            <Link
              href="/dashboard/properties"
              className="mt-6 inline-block border border-slate-700 px-6 py-3 text-sm font-medium hover:bg-slate-800"
            >
              Back to Properties
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">

        {/* ======================================
            BACK
        ====================================== */}

        <div className="mb-6">
          <Link
            href={`/dashboard/properties/${property.$id}`}
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back to Property Details
          </Link>
        </div>

        {/* ======================================
            HEADER
        ====================================== */}

        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Property Management
          </p>

          <h1 className="text-3xl font-semibold sm:text-4xl">
            Edit Property
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Update your property information below.
          </p>
        </div>

        {/* ======================================
            FORM
        ====================================== */}

        <form
          onSubmit={handleSubmit}
          className="border border-slate-800 bg-slate-900"
        >

          {/* ====================================
              SECTION 01
          ==================================== */}

          <section className="border-b border-slate-800 p-6 sm:p-8">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Section 01
            </p>

            <h2 className="mt-1 mb-6 text-xl font-semibold">
              Basic Information
            </h2>

            <div className="grid gap-6 md:grid-cols-2">

              {/* PROPERTY NAME */}

              <div>
                <label
                  htmlFor="propertyName"
                  className="mb-2 block text-sm font-medium"
                >
                  Property Name
                </label>

                <input
                  id="propertyName"
                  name="propertyName"
                  type="text"
                  value={
                    formData.propertyName
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* PROPERTY TYPE */}

              <div>
                <label
                  htmlFor="propertyType"
                  className="mb-2 block text-sm font-medium"
                >
                  Property Type
                </label>

                <select
                  id="propertyType"
                  name="propertyType"
                  value={
                    formData.propertyType
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Apartment">
                    Apartment
                  </option>

                  <option value="House">
                    House
                  </option>

                  <option value="Office">
                    Office
                  </option>

                  <option value="Villa">
                    Villa
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

            </div>
          </section>

          {/* ====================================
              SECTION 02
          ==================================== */}

          <section className="border-b border-slate-800 p-6 sm:p-8">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Section 02
            </p>

            <h2 className="mt-1 mb-6 text-xl font-semibold">
              Address & Location
            </h2>

            <div className="space-y-6">

              {/* ADDRESS */}

              <div>
                <label
                  htmlFor="address"
                  className="mb-2 block text-sm font-medium"
                >
                  Address
                </label>

                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  value={
                    formData.address
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

              {/* LOCATION */}

              <div>
                <label
                  htmlFor="location"
                  className="mb-2 block text-sm font-medium"
                >
                  Location

                  <span className="ml-2 text-xs text-slate-500">
                    Optional
                  </span>
                </label>

                <input
                  id="location"
                  name="location"
                  type="text"
                  value={
                    formData.location
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </div>

            </div>
          </section>

          {/* ====================================
              SECTION 03
          ==================================== */}

          <section className="border-b border-slate-800 p-6 sm:p-8">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Section 03
            </p>

            <h2 className="mt-1 mb-6 text-xl font-semibold">
              Rooms & Areas
            </h2>

            <textarea
              id="rooms"
              name="rooms"
              rows={4}
              value={
                formData.rooms
              }
              onChange={
                handleChange
              }
              placeholder="Example: 2 Bedrooms, 1 Kitchen, 1 Living Room, 1 Bathroom"
              className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-400"
            />

          </section>

          {/* ====================================
              SECTION 04 - PROPERTY IMAGES
          ==================================== */}

          <section className="border-b border-slate-800 p-6 sm:p-8">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Section 04
            </p>

            <h2 className="mt-1 mb-2 text-xl font-semibold">
              Property Images
            </h2>

            <p className="mb-6 text-sm text-slate-400">
              Manage your existing property images or add new ones.
              Maximum 5 images.
            </p>

            {/* ==================================
                EXISTING IMAGES
            ================================== */}

            {existingImages.length >
              0 && (
              <div className="mb-8">

                <h3 className="mb-4 text-sm font-medium">
                  Existing Images
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  {existingImages.map(
                    (fileId) => {
                      const imageUrl =
                        existingImageUrls[
                          fileId
                        ];

                      return (
                        <div
                          key={fileId}
                          className="relative overflow-hidden border border-slate-700 bg-slate-950"
                        >

                          {/* IMAGE */}

                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt="Property"
                              className="h-48 w-full object-cover"
                              onLoad={() => {
                                console.log(
                                  "PROPERTY IMAGE LOADED:",
                                  fileId
                                );
                              }}
                              onError={(
                                event
                              ) => {
                                console.error(
                                  "PROPERTY IMAGE FAILED:",
                                  fileId,
                                  imageUrl
                                );

                                event.currentTarget.style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                              Loading image...
                            </div>
                          )}

                          {/* REMOVE BUTTON */}

                          <button
                            type="button"
                            onClick={() =>
                              removeExistingImage(
                                fileId
                              )
                            }
                            className="absolute right-2 top-2 border border-red-500 bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Remove
                          </button>

                        </div>
                      );
                    }
                  )}

                </div>
              </div>
            )}

            {/* ==================================
                NEW IMAGE PREVIEWS
            ================================== */}

            {newImagePreviews.length >
              0 && (
              <div className="mb-8">

                <h3 className="mb-4 text-sm font-medium">
                  New Images
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  {newImagePreviews.map(
                    (
                      preview,
                      index
                    ) => (
                      <div
                        key={preview}
                        className="relative overflow-hidden border border-slate-700"
                      >

                        <img
                          src={preview}
                          alt="New property"
                          className="h-48 w-full object-cover"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeNewImage(
                              index
                            )
                          }
                          className="absolute right-2 top-2 border border-red-500 bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Remove
                        </button>

                      </div>
                    )
                  )}

                </div>
              </div>
            )}

            {/* ==================================
                ADD NEW IMAGES
            ================================== */}

            {existingImages.length +
              newImages.length <
              5 && (
              <div className="border border-dashed border-slate-700 bg-slate-950 p-8">

                <label
                  htmlFor="propertyImages"
                  className="block cursor-pointer text-center"
                >

                  <span className="block text-sm font-semibold">
                    Add Property Images
                  </span>

                  <span className="mt-2 block text-xs text-slate-500">
                    JPG, JPEG, PNG or WEBP
                  </span>

                  <span className="mt-1 block text-xs text-slate-500">
                    Maximum 10 MB each
                  </span>

                  <span className="mt-5 inline-block border border-slate-600 px-5 py-2 text-xs font-semibold hover:bg-slate-800">
                    Choose Images
                  </span>

                </label>

                <input
                  id="propertyImages"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={
                    handleImageChange
                  }
                  className="hidden"
                />

              </div>
            )}

          </section>

          {/* ====================================
              SECTION 05 - APPLIANCES
          ==================================== */}

          <section className="border-b border-slate-800 p-6 sm:p-8">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Section 05
            </p>

            <h2 className="mt-1 mb-6 text-xl font-semibold">
              Appliances
            </h2>

            <textarea
              id="appliances"
              name="appliances"
              rows={4}
              value={
                formData.appliances
              }
              onChange={
                handleChange
              }
              placeholder="Example: AC, Refrigerator, TV"
              className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-400"
            />

          </section>

          {/* ====================================
              SECTION 06 - MAINTENANCE
          ==================================== */}

          <section className="border-b border-slate-800 p-6 sm:p-8">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Section 06
            </p>

            <h2 className="mt-1 mb-6 text-xl font-semibold">
              Maintenance
            </h2>

            <div className="grid gap-6 md:grid-cols-2">

              {/* MAINTENANCE HISTORY */}

              <div>
                <label
                  htmlFor="maintenanceHistory"
                  className="mb-2 block text-sm font-medium"
                >
                  Maintenance History
                </label>

                <textarea
                  id="maintenanceHistory"
                  name="maintenanceHistory"
                  rows={5}
                  value={
                    formData.maintenanceHistory
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Example: AC servicing completed in August 2026"
                  className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-400"
                />
              </div>

              {/* UPCOMING MAINTENANCE */}

              <div>
                <label
                  htmlFor="upcomingMaintenance"
                  className="mb-2 block text-sm font-medium"
                >
                  Upcoming Maintenance
                </label>

                <textarea
                  id="upcomingMaintenance"
                  name="upcomingMaintenance"
                  rows={5}
                  value={
                    formData.upcomingMaintenance
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Example: Refrigerator servicing next month"
                  className="w-full resize-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-400"
                />
              </div>

            </div>
          </section>

          {/* ====================================
              ACTIONS
          ==================================== */}

          <section className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-end sm:p-8">

            <Link
              href={`/dashboard/properties/${property.$id}`}
              className="border border-slate-700 px-6 py-3 text-center text-sm font-medium hover:bg-slate-800"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="border border-white bg-white px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Updating..."
                : "Update Property"}
            </button>

          </section>

        </form>
      </div>
    </main>
  );
}