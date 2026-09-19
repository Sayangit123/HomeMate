"use client";

import type { UserRole } from "@/types/auth";

interface RoleSelectorProps {
  value: UserRole | "";
  onChange: (role: UserRole) => void;
  error?: string;
}

const roles: {
  value: UserRole;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "customer",
    title: "Homeowner",
    description:
      "Find trusted professionals and manage your home services.",
    icon: "⌂",
  },

  {
    value: "professional",
    title: "Professional",
    description:
      "Offer your services and connect with customers.",
    icon: "⚒",
  },

  {
    value: "business",
    title: "Business",
    description:
      "Manage your home-service business and reach more customers.",
    icon: "▣",
  },

  {
    value: "admin",
    title: "Administrator",
    description:
      "Manage HomeMate users, services, bookings, complaints and platform settings.",
    icon: "⚙",
  },
];

export default function RoleSelector({
  value,
  onChange,
  error,
}: RoleSelectorProps) {
  return (
    <div className="w-full">

      {/* =====================================================
          ROLE CARDS
      ====================================================== */}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">

        {roles.map((role) => {

          const isSelected =
            value === role.value;

          return (
            <button
              key={role.value}
              type="button"
              onClick={() =>
                onChange(role.value)
              }
              className={`group relative min-h-[190px] border p-5 text-left transition-all duration-200 ${
                isSelected
                  ? "border-slate-900 bg-white shadow-[0_8px_25px_rgba(15,23,42,0.08)]"
                  : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-md"
              }`}
            >

              {/* =================================================
                  ICON + RADIO
              ================================================== */}

              <div className="flex items-center justify-between">

                {/* ICON */}

                <div
                  className={`flex h-10 w-10 items-center justify-center border text-lg transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {role.icon}
                </div>


                {/* RADIO */}

                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-slate-900"
                      : "border-slate-300"
                  }`}
                >

                  {isSelected && (
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                  )}

                </div>

              </div>


              {/* =================================================
                  CONTENT
              ================================================== */}

              <div className="mt-7">

                <h3 className="text-base font-bold text-slate-950">
                  {role.title}
                </h3>


                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {role.description}
                </p>

              </div>


              {/* =================================================
                  ADMIN LABEL
              ================================================== */}

              {role.value === "admin" && (
                <span className="absolute right-5 top-[72px] bg-slate-100 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                  Platform
                </span>
              )}


              {/* =================================================
                  ACTIVE INDICATOR
              ================================================== */}

              <div
                className={`absolute bottom-0 left-0 h-0.5 transition-all duration-300 ${
                  isSelected
                    ? "w-full bg-slate-900"
                    : "w-0 bg-slate-900 group-hover:w-full"
                }`}
              />

            </button>
          );

        })}

      </div>


      {/* =====================================================
          VALIDATION ERROR
      ====================================================== */}

      {error && (
        <p className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

    </div>
  );
}