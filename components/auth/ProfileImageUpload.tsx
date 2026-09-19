"use client";

import { useEffect, useRef, useState } from "react";

interface ProfileImageUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export default function ProfileImageUpload({
  value,
  onChange,
  error,
}: ProfileImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const [fileError, setFileError] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(value);

    setPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [value]);


  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileError("");


    if (!ALLOWED_TYPES.includes(file.type)) {

      setFileError(
        "Please upload a JPG, JPEG, PNG, or WebP image."
      );

      onChange(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }


    if (file.size > MAX_FILE_SIZE) {

      setFileError(
        "Image size must not exceed 5 MB."
      );

      onChange(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }


    onChange(file);
  };


  const handleRemove = () => {
    onChange(null);

    setFileError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };


  const handleChooseImage = () => {
    inputRef.current?.click();
  };


  return (
    <div className="w-full">

      {/* Upload Area */}
      <div
        className={`border border-dashed p-5 transition ${
          fileError || error
            ? "border-red-300 bg-red-50/30"
            : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
        }`}
      >

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

          {/* Preview */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">

            {preview ? (
              <img
                src={preview}
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center">

                <span className="text-2xl text-slate-300">
                  ♙
                </span>

              </div>
            )}

          </div>


          {/* Upload Content */}
          <div className="flex-1">

            {value ? (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  {value.name}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Profile image selected successfully.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  Upload your profile photo
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  PNG, JPG or JPEG • Maximum 5 MB
                </p>
              </>
            )}

          </div>


          {/* Buttons */}
          <div className="flex shrink-0 gap-2">

            <button
              type="button"
              onClick={handleChooseImage}
              className="border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-800 transition hover:border-slate-900 hover:bg-slate-950 hover:text-white"
            >
              {value ? "Change Photo" : "Upload Photo"}
            </button>


            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-red-300 hover:text-red-600"
              >
                Remove
              </button>
            )}

          </div>

        </div>


        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

      </div>


      {/* Error */}
      {(fileError || error) && (
        <p className="mt-2 text-xs font-medium text-red-600">
          {fileError || error}
        </p>
      )}

    </div>
  );
}