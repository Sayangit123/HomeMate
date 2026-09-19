"use client";

import { useState } from "react";

import {
  useForm,
} from "react-hook-form";

import {
  yupResolver,
} from "@hookform/resolvers/yup";

import * as yup from "yup";

import Swal from "sweetalert2";

import {
  User,
  BriefcaseBusiness,
  Building2,
  Mail,
  Phone,
  LockKeyhole,
  Eye,
  EyeOff,
  UserRound,
  ShieldCheck,
  ArrowRight,
  Check,
  Sparkles,
  Camera,
} from "lucide-react";

import {
  createAccount,
  loginAccount,
  logoutAccount,
} from "@/lib/appwrite/account";

import {
  createMember,
} from "@/lib/appwrite/database";

import {
  uploadProfileImage,
} from "@/lib/appwrite/storage";

import type {
  RegistrationFormData,
  UserRole,
} from "@/types/auth";

import ProfileImageUpload from "./ProfileImageUpload";


/* ============================================================
   VALIDATION PATTERNS
============================================================ */

const fullNamePattern =
  /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

const emailPattern =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

const phonePattern =
  /^[6-9]\d{9}$/;

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;


/* ============================================================
   REGISTRATION SCHEMA
   ADMIN IS NOT ALLOWED
============================================================ */

const registrationSchema =
  yup.object({

    fullName:
      yup
        .string()
        .required(
          "Full name is required"
        )
        .matches(
          fullNamePattern,
          "Name can contain only letters and spaces"
        ),

    email:
      yup
        .string()
        .required(
          "Email address is required"
        )
        .matches(
          emailPattern,
          "Please enter a valid email address"
        ),

    phone:
      yup
        .string()
        .required(
          "Phone number is required"
        )
        .matches(
          phonePattern,
          "Enter a valid 10-digit Indian mobile number"
        ),

    password:
      yup
        .string()
        .required(
          "Password is required"
        )
        .matches(
          passwordPattern,
          "Password must contain uppercase, lowercase, number and special character"
        ),

    confirmPassword:
      yup
        .string()
        .required(
          "Please confirm your password"
        )
        .oneOf(
          [
            yup.ref("password"),
          ],
          "Passwords do not match"
        ),

    role:
      yup
        .mixed<UserRole>()
        .oneOf(
          [
            "customer",
            "professional",
            "business",
          ] as UserRole[],
          "Please select a valid account type"
        )
        .required(
          "Please select an account type"
        ),

  });


/* ============================================================
   ROLE DATA
   ADMIN IS INTENTIONALLY NOT INCLUDED
============================================================ */

const roles = [

  {
    value:
      "customer" as UserRole,

    title:
      "Customer",

    description:
      "Book trusted professionals for your home.",

    icon:
      User,
  },

  {
    value:
      "professional" as UserRole,

    title:
      "Professional",

    description:
      "Offer your services and reach customers.",

    icon:
      BriefcaseBusiness,
  },

  {
    value:
      "business" as UserRole,

    title:
      "Business",

    description:
      "Grow your business with HomeMate.",

    icon:
      Building2,
  },

];


/* ============================================================
   COMPONENT
============================================================ */

export default function RegistrationForm() {

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);


  const [
    profileImage,
    setProfileImage,
  ] = useState<File | null>(null);


  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);


  /* ==========================================================
     FORM
  ========================================================== */

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: {
      errors,
    },
  } =
    useForm<RegistrationFormData>({

      resolver:
        yupResolver(
          registrationSchema
        ) as never,

      defaultValues: {

        fullName:
          "",

        email:
          "",

        phone:
          "",

        password:
          "",

        confirmPassword:
          "",

        role:
          undefined,

      },

    });


  const selectedRole =
    watch("role");


  const password =
    watch("password");


  const confirmPassword =
    watch("confirmPassword");


  /* ==========================================================
     ROLE CHANGE
  ========================================================== */

  const handleRoleChange = (
    role: UserRole
  ) => {

    setValue(
      "role",
      role,
      {
        shouldValidate:
          true,

        shouldDirty:
          true,
      }
    );

  };


  /* ==========================================================
     SUBMIT
     EXISTING APPWRITE LOGIC PRESERVED
  ========================================================== */

  const onSubmit = async (
    data: RegistrationFormData
  ) => {

    try {

      setIsLoading(true);


      /* ========================================================
         01 — CREATE APPWRITE ACCOUNT
      ======================================================== */

      const user =
        await createAccount(
          data.email.trim(),
          data.password,
          data.fullName.trim()
        );


      console.log(
        "Appwrite account created:",
        user.$id
      );


      /* ========================================================
         02 — LOGIN USER
      ======================================================== */

      await loginAccount(
        data.email.trim(),
        data.password
      );


      console.log(
        "Appwrite session created."
      );


      /* ========================================================
         03 — UPLOAD PROFILE IMAGE
      ======================================================== */

      let profileImageId:
        string | null = null;


      if (profileImage) {

        console.log(
          "Uploading profile image..."
        );


        const uploadedFile =
          await uploadProfileImage(
            profileImage
          );


        profileImageId =
          uploadedFile.$id;


        console.log(
          "Profile image uploaded:",
          profileImageId
        );

      }


      /* ========================================================
         04 — CREATE MEMBERS ROW
      ======================================================== */

      await createMember({

        userId:
          user.$id,

        fullName:
          data.fullName.trim(),

        phone:
          data.phone.trim(),

        role:
          data.role,

        profileImage:
          profileImageId,

      });


      console.log(
        "Members record created successfully.",
        {
          userId:
            user.$id,

          fullName:
            data.fullName.trim(),

          phone:
            data.phone.trim(),

          role:
            data.role,

          profileImage:
            profileImageId,
        }
      );


      /* ========================================================
         05 — LOGOUT TEMPORARY SESSION
      ======================================================== */

      try {

        await logoutAccount();

      } catch (
        logoutError
      ) {

        console.error(
          "Registration logout error:",
          logoutError
        );

      }


      /* ========================================================
         06 — SUCCESS ALERT
      ======================================================== */

      await Swal.fire({

        icon:
          "success",

        title:
          "Registration Successful",

        text:
          "Your HomeMate account has been created successfully.",

        confirmButtonText:
          "Continue",

        confirmButtonColor:
          "#111827",

        background:
          "#ffffff",

        color:
          "#111827",

      });


      /* ========================================================
         07 — GO TO LOGIN
      ======================================================== */

      window.location.href =
        "/login";


    } catch (
      error: unknown
    ) {

      console.error(
        "Registration error:",
        error
      );


      let message =
        "Something went wrong during registration.";


      if (
        error instanceof Error
      ) {

        message =
          error.message;

      }


      await Swal.fire({

        icon:
          "error",

        title:
          "Registration Failed",

        text:
          message,

        confirmButtonText:
          "Try Again",

        confirmButtonColor:
          "#111827",

        background:
          "#ffffff",

        color:
          "#111827",

      });


    } finally {

      setIsLoading(false);

    }

  };


  /* ============================================================
     PROFESSIONAL INPUT STYLE
============================================================ */

  const inputClass = (
    hasError: boolean
  ) => `
    h-11
    w-full
    rounded-lg
    border
    bg-white
    px-3
    text-[11px]
    text-gray-800
    outline-none
    transition-all
    duration-200
    placeholder:text-gray-400
    ${
      hasError
        ? `
          border-red-400
          focus:border-red-500
          focus:ring-2
          focus:ring-red-100
        `
        : `
          border-gray-200
          hover:border-gray-300
          focus:border-gray-400
          focus:ring-2
          focus:ring-gray-100
        `
    }
  `;


  /* ============================================================
     UI
============================================================ */

  return (

    <form
      onSubmit={
        handleSubmit(onSubmit)
      }

      className="
        w-full
        bg-white
        px-6
        py-7
        text-gray-900
        sm:px-8
      "
    >


      {/* ======================================================
          01 — ACCOUNT TYPE
      ====================================================== */}

      <section>

        <div
          className="
            mb-4
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h2
              className="
                text-[13px]
                font-bold
                text-gray-900
              "
            >
              Account Type
            </h2>

            <p
              className="
                mt-1
                text-[9px]
                text-gray-400
              "
            >
              Choose how you want to use HomeMate
            </p>

          </div>

          <span
            className="
              text-[9px]
              font-medium
              uppercase
              tracking-wider
              text-gray-400
            "
          >
            Required
          </span>

        </div>


        {/* ROLE CARDS */}

        <div
          className="
            grid
            grid-cols-3
            gap-2
          "
        >

          {roles.map(
            (role) => {

              const Icon =
                role.icon;

              const isSelected =
                selectedRole ===
                role.value;


              return (

                <button
                  key={
                    role.value
                  }

                  type="button"

                  onClick={() =>
                    handleRoleChange(
                      role.value
                    )
                  }

                  className={`
                    relative
                    flex
                    min-h-[72px]
                    flex-col
                    items-center
                    justify-center
                    rounded-lg
                    border
                    px-2
                    py-3
                    text-center
                    transition-all
                    duration-200

                    ${
                      isSelected
                        ? `
                          border-gray-900
                          bg-gray-900
                          text-white
                          shadow-sm
                        `
                        : `
                          border-gray-200
                          bg-gray-50
                          text-gray-600
                          hover:border-gray-400
                          hover:bg-white
                        `
                    }
                  `}
                >

                  {isSelected && (

                    <span
                      className="
                        absolute
                        right-1.5
                        top-1.5
                        flex
                        h-4
                        w-4
                        items-center
                        justify-center
                        rounded-full
                        bg-white
                        text-gray-900
                      "
                    >
                      <Check
                        size={9}
                        strokeWidth={3}
                      />
                    </span>

                  )}


                  <Icon
                    size={16}
                    strokeWidth={1.8}
                    className={
                      isSelected
                        ? "text-white"
                        : "text-gray-500"
                    }
                  />


                  <span
                    className="
                      mt-1.5
                      text-[9px]
                      font-semibold
                    "
                  >
                    {role.title}
                  </span>

                </button>

              );

            }
          )}

        </div>


        {errors.role && (

          <p
            className="
              mt-2
              text-[9px]
              text-red-500
            "
          >
            {errors.role.message}
          </p>

        )}

      </section>


      {/* ======================================================
          DIVIDER
      ====================================================== */}

      <div
        className="
          my-6
          h-px
          bg-gray-100
        "
      />


      {/* ======================================================
          02 — PERSONAL INFORMATION
      ====================================================== */}

      <section>

        <div
          className="
            mb-4
          "
        >

          <h2
            className="
              text-[13px]
              font-bold
              text-gray-900
            "
          >
            Personal Information
          </h2>

          <p
            className="
              mt-1
              text-[9px]
              text-gray-400
            "
          >
            Enter your basic account information
          </p>

        </div>


        <div
          className="
            space-y-4
          "
        >


          {/* FULL NAME */}

          <div>

            <label
              htmlFor="fullName"
              className="
                mb-1.5
                block
                text-[10px]
                font-semibold
                text-gray-600
              "
            >
              Full Name
              <span
                className="
                  ml-1
                  text-red-500
                "
              >
                *
              </span>
            </label>


            <div
              className="
                relative
              "
            >

              <User
                size={14}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />


              <input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                {...register(
                  "fullName"
                )}
                className={`
                  ${inputClass(
                    !!errors.fullName
                  )}
                  pl-10
                `}
              />

            </div>


            {errors.fullName && (

              <p
                className="
                  mt-1
                  text-[9px]
                  text-red-500
                "
              >
                {
                  errors
                    .fullName
                    .message
                }
              </p>

            )}

          </div>


          {/* EMAIL + PHONE */}

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
            "
          >


            {/* EMAIL */}

            <div>

              <label
                htmlFor="email"
                className="
                  mb-1.5
                  block
                  text-[10px]
                  font-semibold
                  text-gray-600
                "
              >
                Email Address
                <span
                  className="
                    ml-1
                    text-red-500
                  "
                >
                  *
                </span>
              </label>


              <div
                className="
                  relative
                "
              >

                <Mail
                  size={14}
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />


                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...register(
                    "email"
                  )}
                  className={`
                    ${inputClass(
                      !!errors.email
                    )}
                    pl-10
                  `}
                />

              </div>


              {errors.email && (

                <p
                  className="
                    mt-1
                    text-[9px]
                    text-red-500
                  "
                >
                  {
                    errors
                      .email
                      .message
                  }
                </p>

              )}

            </div>


            {/* PHONE */}

            <div>

              <label
                htmlFor="phone"
                className="
                  mb-1.5
                  block
                  text-[10px]
                  font-semibold
                  text-gray-600
                "
              >
                Phone Number
                <span
                  className="
                    ml-1
                    text-red-500
                  "
                >
                  *
                </span>
              </label>


              <div
                className="
                  relative
                "
              >

                <Phone
                  size={14}
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />


                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit number"
                  {...register(
                    "phone"
                  )}
                  className={`
                    ${inputClass(
                      !!errors.phone
                    )}
                    pl-10
                  `}
                />

              </div>


              {errors.phone && (

                <p
                  className="
                    mt-1
                    text-[9px]
                    text-red-500
                  "
                >
                  {
                    errors
                      .phone
                      .message
                  }
                </p>

              )}

            </div>

          </div>

        </div>

      </section>


      {/* ======================================================
          DIVIDER
      ====================================================== */}

      <div
        className="
          my-6
          h-px
          bg-gray-100
        "
      />


      {/* ======================================================
          03 — SECURITY
      ====================================================== */}

      <section>

        <div
          className="
            mb-4
          "
        >

          <h2
            className="
              text-[13px]
              font-bold
              text-gray-900
            "
          >
            Account Security
          </h2>

          <p
            className="
              mt-1
              text-[9px]
              text-gray-400
            "
          >
            Create a secure password for your account
          </p>

        </div>


        <div
          className="
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
          "
        >


          {/* PASSWORD */}

          <div>

            <label
              htmlFor="password"
              className="
                mb-1.5
                block
                text-[10px]
                font-semibold
                text-gray-600
              "
            >
              Password
              <span
                className="
                  ml-1
                  text-red-500
                "
              >
                *
              </span>
            </label>


            <div
              className="
                relative
              "
            >

              <LockKeyhole
                size={14}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />


              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Create password"
                {...register(
                  "password"
                )}
                className={`
                  ${inputClass(
                    !!errors.password
                  )}
                  pl-10
                  pr-10
                `}
              />


              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) =>
                      !value
                  )
                }
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                  transition
                  hover:text-gray-700
                "
              >

                {showPassword ? (
                  <EyeOff
                    size={14}
                  />
                ) : (
                  <Eye
                    size={14}
                  />
                )}

              </button>

            </div>


            {errors.password && (

              <p
                className="
                  mt-1
                  text-[9px]
                  text-red-500
                "
              >
                {
                  errors
                    .password
                    .message
                }
              </p>

            )}

          </div>


          {/* CONFIRM PASSWORD */}

          <div>

            <label
              htmlFor="confirmPassword"
              className="
                mb-1.5
                block
                text-[10px]
                font-semibold
                text-gray-600
              "
            >
              Confirm Password
              <span
                className="
                  ml-1
                  text-red-500
                "
              >
                *
              </span>
            </label>


            <div
              className="
                relative
              "
            >

              <LockKeyhole
                size={14}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />


              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                placeholder="Confirm password"
                {...register(
                  "confirmPassword"
                )}
                className={`
                  ${inputClass(
                    !!errors.confirmPassword
                  )}
                  pl-10
                  pr-10
                `}
              />


              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (value) =>
                      !value
                  )
                }
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                  transition
                  hover:text-gray-700
                "
              >

                {showConfirmPassword ? (
                  <EyeOff
                    size={14}
                  />
                ) : (
                  <Eye
                    size={14}
                  />
                )}

              </button>

            </div>


            {password &&
              confirmPassword &&
              password ===
                confirmPassword && (

                <p
                  className="
                    mt-1
                    flex
                    items-center
                    gap-1
                    text-[9px]
                    text-emerald-600
                  "
                >

                  <Check
                    size={10}
                    strokeWidth={3}
                  />

                  Passwords match

                </p>

              )}


            {errors.confirmPassword && (

              <p
                className="
                  mt-1
                  text-[9px]
                  text-red-500
                "
              >
                {
                  errors
                    .confirmPassword
                    .message
                }
              </p>

            )}

          </div>

        </div>


        {/* PASSWORD REQUIREMENT */}

        <div
          className="
            mt-4
            rounded-lg
            border
            border-gray-100
            bg-gray-50
            px-3
            py-2.5
          "
        >

          <div
            className="
              flex
              items-start
              gap-2
            "
          >

            <ShieldCheck
              size={13}
              className="
                mt-0.5
                shrink-0
                text-gray-500
              "
            />

            <p
              className="
                text-[9px]
                leading-4
                text-gray-500
              "
            >
              Use at least 8 characters with
              uppercase, lowercase, a number
              and a special character.
            </p>

          </div>

        </div>

      </section>


      {/* ======================================================
          DIVIDER
      ====================================================== */}

      <div
        className="
          my-6
          h-px
          bg-gray-100
        "
      />


      {/* ======================================================
          04 — PROFILE PHOTO
      ====================================================== */}

      <section>

        <div
          className="
            mb-4
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h2
              className="
                text-[13px]
                font-bold
                text-gray-900
              "
            >
              Profile Photo
            </h2>

            <p
              className="
                mt-1
                text-[9px]
                text-gray-400
              "
            >
              Add a photo to personalize your profile
            </p>

          </div>


          <span
            className="
              text-[9px]
              text-gray-400
            "
          >
            Optional
          </span>

        </div>


        <div
          className="
            rounded-lg
            border
            border-dashed
            border-gray-200
            bg-gray-50
            p-4
          "
        >

          <div
            className="
              mb-3
              flex
              items-center
              gap-2
            "
          >

            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-md
                bg-white
                text-gray-500
                shadow-sm
              "
            >

              <Camera
                size={13}
              />

            </div>


            <span
              className="
                text-[10px]
                font-medium
                text-gray-600
              "
            >
              Upload your profile image
            </span>

          </div>


          <ProfileImageUpload
            value={
              profileImage
            }
            onChange={
              setProfileImage
            }
          />

        </div>

      </section>


      {/* ======================================================
          FINAL ACTION
      ====================================================== */}

      <div
        className="
          mt-6
        "
      >

        <button
          type="submit"
          disabled={isLoading}

          className="
            group
            flex
            h-11
            w-full
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-gray-900
            px-5
            text-[11px]
            font-bold
            text-white
            shadow-sm
            transition-all
            duration-200
            hover:bg-black
            hover:shadow-md
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >

          {isLoading ? (

            <>

              <span
                className="
                  h-4
                  w-4
                  animate-spin
                  rounded-full
                  border-2
                  border-white/30
                  border-t-white
                "
              />

              <span>
                Creating Account...
              </span>

            </>

          ) : (

            <>

              <span>
                Create HomeMate Account
              </span>

              <ArrowRight
                size={14}
                className="
                  transition-transform
                  duration-200
                  group-hover:translate-x-1
                "
              />

            </>

          )}

        </button>


        {/* LOGIN */}

        <p
          className="
            mt-4
            text-center
            text-[10px]
            text-gray-400
          "
        >

          Already have an account?

          <a
            href="/login"
            className="
              ml-1
              font-semibold
              text-gray-900
              underline
              underline-offset-2
              transition
              hover:text-gray-500
            "
          >
            Sign In
          </a>

        </p>


        {/* TERMS */}

        <p
          className="
            mt-3
            text-center
            text-[8px]
            leading-4
            text-gray-400
          "
        >
          By creating an account, you agree to
          HomeMate&apos;s Terms of Service and
          Privacy Policy.
        </p>

      </div>

    </form>

  );
}