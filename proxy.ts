import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";

import createSessionClient from "@/lib/appwrite/server";


/* ============================================================
   SESSION COOKIE
============================================================ */

const SESSION_COOKIE = "homemate-session";


export async function proxy(
  request: NextRequest
) {

  const { pathname } =
    request.nextUrl;


  /* ==========================================================
     AUTH PAGES
  ========================================================== */

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/register/");


  /* ==========================================================
     DASHBOARD PAGES
  ========================================================== */

  const isDashboardPage =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");


  /* ==========================================================
     ADMIN DASHBOARD
  ========================================================== */

  const isAdminPage =
    pathname === "/dashboard/admin" ||
    pathname.startsWith(
      "/dashboard/admin/"
    );


  /* ==========================================================
     HOMEmate FEATURE PAGES

     These are the pages opened from the
     cards on the HomeMate home page.
  ========================================================== */

  const isHomeMateFeaturePage =
    pathname === "/services" ||
    pathname.startsWith("/services/") ||

    pathname === "/professionals" ||
    pathname.startsWith("/professionals/") ||

    pathname === "/bookings" ||
    pathname.startsWith("/bookings/") ||

    pathname === "/properties" ||
    pathname.startsWith("/properties/") ||

    pathname === "/community" ||
    pathname.startsWith("/community/");


  /* ==========================================================
     SESSION
  ========================================================== */

  const session =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;


  /* ============================================================
     NO SESSION
  ============================================================ */

  if (!session) {

    /*
      Dashboard pages require authentication.
    */

    if (isDashboardPage) {

      return NextResponse.redirect(
        new URL(
          "/login",
          request.url
        )
      );

    }


    /*
      HomeMate feature cards also require
      authentication.

      Example:

      /
       ↓
      Click Home Services
       ↓
      /services
       ↓
      Proxy
       ↓
      No session
       ↓
      /login
    */

    if (
      isHomeMateFeaturePage
    ) {

      return NextResponse.redirect(
        new URL(
          "/login",
          request.url
        )
      );

    }


    /*
      Login/Register and public pages
      are allowed.
    */

    return NextResponse.next();

  }


  /* ============================================================
     AUTHENTICATED USER
  ============================================================ */

  try {

    const {
      account,
      tablesDB,
    } =
      createSessionClient(
        session
      );


    /* ==========================================================
       GET CURRENT APPWRITE USER
    ========================================================== */

    const user =
      await account.get();


    /* ==========================================================
       GET MEMBER RECORD
    ========================================================== */

    const memberResponse =
      await tablesDB.listRows({

        databaseId:
          process.env
            .NEXT_PUBLIC_APPWRITE_DATABASE_ID!,

        tableId:
          process.env
            .NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID!,

        queries: [

          Query.equal(
            "userId",
            user.$id
          ),

          Query.limit(1),

        ],

      });


    const member =
      memberResponse.rows[0];


    /* ==========================================================
       MEMBER NOT FOUND
    ========================================================== */

    if (!member) {

      if (
        isDashboardPage ||
        isHomeMateFeaturePage
      ) {

        return NextResponse.redirect(
          new URL(
            "/login",
            request.url
          )
        );

      }

      return NextResponse.next();

    }


    /* ==========================================================
       USER ROLE
    ========================================================== */

    const role =
      member.role;


    /* ==========================================================
       ADMIN REDIRECT

       Admin opening:

       /dashboard

       ↓

       /dashboard/admin
    ========================================================== */

    if (
      role === "admin" &&
      pathname === "/dashboard"
    ) {

      return NextResponse.redirect(
        new URL(
          "/dashboard/admin",
          request.url
        )
      );

    }


    /* ==========================================================
       ADMIN PROTECTION

       Customer / Professional / Business

       trying to open:

       /dashboard/admin

       ↓

       /dashboard
    ========================================================== */

    if (
      isAdminPage &&
      role !== "admin"
    ) {

      return NextResponse.redirect(
        new URL(
          "/dashboard",
          request.url
        )
      );

    }


    /* ==========================================================
       PROFESSIONAL VERIFICATION PROTECTION
    ========================================================== */

    if (
      pathname.startsWith(
        "/dashboard/verification"
      )
    ) {

      if (
        role !== "professional"
      ) {

        return NextResponse.redirect(
          new URL(
            "/dashboard",
            request.url
          )
        );

      }

    }


    /* ==========================================================
       AUTH PAGE REDIRECT

       Logged-in users should not return
       to Login/Register.
    ========================================================== */

    if (isAuthPage) {

      if (
        role === "admin"
      ) {

        return NextResponse.redirect(
          new URL(
            "/dashboard/admin",
            request.url
          )
        );

      }


      return NextResponse.redirect(
        new URL(
          "/dashboard",
          request.url
        )
      );

    }


    /* ==========================================================
       HOMEmate FEATURE PAGES

       Authenticated users are allowed.

       Example:

       /services
       /professionals
       /bookings
       /properties
       /community
    ========================================================== */

    if (
      isHomeMateFeaturePage
    ) {

      return NextResponse.next();

    }


    /* ==========================================================
       ALLOW REQUEST
    ========================================================== */

    return NextResponse.next();

  } catch (
    error
  ) {

    console.error(
      "Proxy authentication error:",
      error
    );


    /* ==========================================================
       INVALID / EXPIRED SESSION
    ========================================================== */

    const response =
      NextResponse.redirect(
        new URL(
          "/login",
          request.url
        )
      );


    response.cookies.delete(
      SESSION_COOKIE
    );


    return response;

  }

}


/* ================================================================
   PROXY MATCHER
================================================================ */

export const config = {

  matcher: [

    /* Dashboard */

    "/dashboard/:path*",


    /* Authentication */

    "/login",

    "/register",

    "/register/:path*",


    /* HomeMate feature pages */

    "/services",

    "/services/:path*",

    "/professionals",

    "/professionals/:path*",

    "/bookings",

    "/bookings/:path*",

    "/properties",

    "/properties/:path*",

    "/community",

    "/community/:path*",

  ],

};