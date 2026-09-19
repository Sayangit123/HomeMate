"use client";

import { useState } from "react";

import { useForm } from "react-hook-form";

import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";

import Swal from "sweetalert2";

import {
    loginAccount,
    getCurrentUser,
} from "@/lib/appwrite/account";

import {
    getCurrentMember,
} from "@/lib/appwrite/database";


interface LoginFormData {
    email: string;
    password: string;
}


/* =============================================================
   PATTERN VALIDATION
============================================================= */

const emailPattern =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;


/* =============================================================
   YUP VALIDATION
============================================================= */

const loginSchema = yup.object({
    email: yup
        .string()
        .required("Email address is required")
        .matches(
            emailPattern,
            "Please enter a valid email address"
        ),

    password: yup
        .string()
        .required("Password is required")
        .matches(
            passwordPattern,
            "Password must contain uppercase, lowercase, number and special character"
        ),
});


/* =============================================================
   LOGIN FORM
============================================================= */

export default function LoginForm() {

    const [isLoading, setIsLoading] =
        useState(false);

    const [showPassword, setShowPassword] =
        useState(false);


    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: yupResolver(loginSchema),

        defaultValues: {
            email: "",
            password: "",
        },
    });


    /* ===========================================================
       SUBMIT
    =========================================================== */

    const onSubmit = async (
        data: LoginFormData
    ) => {

        try {

            setIsLoading(true);


            /* =====================================================
               STEP 1
               APPWRITE BROWSER LOGIN
            ===================================================== */

            await loginAccount(
                data.email,
                data.password
            );


            /* =====================================================
               STEP 2
               VERIFY BROWSER USER
            ===================================================== */

            const loggedInUser =
                await getCurrentUser();


            if (!loggedInUser) {

                throw new Error(
                    "Unable to verify your Appwrite login session."
                );
            }


            /* =====================================================
               STEP 3
               CREATE SERVER SESSION COOKIE
            ===================================================== */

            const serverResponse =
                await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({
                            email:
                                data.email,

                            password:
                                data.password,
                        }),
                    }
                );


            const serverResult =
                await serverResponse.json();


            if (!serverResponse.ok) {

                throw new Error(
                    serverResult.message ||
                    "Unable to create server session."
                );
            }


            /* =====================================================
               STEP 4
               GET MEMBER PROFILE
            ===================================================== */

            const currentMember =
                await getCurrentMember(
                    loggedInUser.$id
                );


            if (!currentMember) {

                throw new Error(
                    "Your HomeMate member profile could not be found."
                );
            }


            /* =====================================================
               SUCCESS
            ===================================================== */

            await Swal.fire({

                icon: "success",

                title: "Welcome Back",

                text:
                    "You have successfully signed in to HomeMate.",

                confirmButtonText:
                    "Continue",

                confirmButtonColor:
                    "#2563eb",
            });


            /* =====================================================
               ONE DASHBOARD FOR EVERY ROLE
            ===================================================== */

            window.location.href =
                "/dashboard";


        } catch (error: unknown) {

            console.error(
                "Login error:",
                error
            );


            let message =
                "Unable to sign in. Please try again.";


            if (error instanceof Error) {

                message =
                    error.message;
            }


            await Swal.fire({

                icon: "error",

                title: "Login Failed",

                text: message,

                confirmButtonText:
                    "Try Again",

                confirmButtonColor:
                    "#2563eb",
            });


        } finally {

            setIsLoading(false);
        }
    };


    return (

        <form
            onSubmit={
                handleSubmit(onSubmit)
            }
            className="space-y-6"
        >

            {/* =====================================================
                EMAIL
            ====================================================== */}

            <div>

                <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-bold text-slate-700"
                >

                    Email Address

                    <span className="ml-1 text-red-500">
                        *
                    </span>

                </label>


                <div className="relative">

                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        @
                    </span>


                    <input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...register("email")}
                        className={`h-13 w-full rounded-xl border bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${
                            errors.email
                                ? "border-red-400 bg-red-50/20"
                                : "border-slate-200"
                        }`}
                    />

                </div>


                {errors.email && (

                    <p className="mt-2 text-xs font-medium text-red-600">

                        {errors.email.message}

                    </p>

                )}

            </div>


            {/* =====================================================
                PASSWORD
            ====================================================== */}

            <div>

                <div className="mb-2 flex items-center justify-between">

                    <label
                        htmlFor="password"
                        className="block text-xs font-bold text-slate-700"
                    >

                        Password

                        <span className="ml-1 text-red-500">
                            *
                        </span>

                    </label>


                    <button
                        type="button"
                        className="text-[10px] font-bold text-blue-600 transition hover:text-blue-800"
                    >
                        Forgot password?
                    </button>

                </div>


                <div className="relative">

                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        🔒
                    </span>


                    <input
                        id="password"
                        type={
                            showPassword
                                ? "text"
                                : "password"
                        }
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        {...register("password")}
                        className={`h-13 w-full rounded-xl border bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${
                            errors.password
                                ? "border-red-400 bg-red-50/20"
                                : "border-slate-200"
                        }`}
                    />


                    <button
                        type="button"
                        onClick={() =>
                            setShowPassword(
                                (value) =>
                                    !value
                            )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 transition hover:text-blue-600"
                        aria-label={
                            showPassword
                                ? "Hide password"
                                : "Show password"
                        }
                    >

                        {showPassword
                            ? "◉"
                            : "◌"}

                    </button>

                </div>


                {errors.password && (

                    <p className="mt-2 text-xs font-medium text-red-600">

                        {errors.password.message}

                    </p>

                )}

            </div>


            {/* =====================================================
                REMEMBER ME
            ====================================================== */}

            <label className="flex cursor-pointer items-center gap-3">

                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />

                <span className="text-xs text-slate-500">
                    Keep me signed in
                </span>

            </label>


            {/* =====================================================
                LOGIN BUTTON
            ====================================================== */}

            <button
                type="submit"
                disabled={isLoading}
                className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition duration-300 hover:bg-blue-700 hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60"
            >

                <span>

                    {isLoading
                        ? "Signing In..."
                        : "Sign In"}

                </span>


                {!isLoading && (

                    <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                        →
                    </span>

                )}

            </button>


            {/* =====================================================
                SECURITY INFO
            ====================================================== */}

            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">

                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600">
                    ✓
                </span>


                <p className="text-[11px] leading-5 text-slate-500">

                    Your login session is securely handled by
                    HomeMate&apos;s authentication system.

                </p>

            </div>

        </form>
    );
}