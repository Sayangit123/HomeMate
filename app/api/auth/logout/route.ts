import { NextRequest, NextResponse } from "next/server";

import createSessionClient from "@/lib/appwrite/server";

const SESSION_COOKIE = "homemate-session";

export async function POST(request: NextRequest) {
  try {
    const session =
      request.cookies.get(SESSION_COOKIE)?.value;

    if (session) {
      const { account } =
        createSessionClient(session);

      try {
        await account.deleteSession("current");
      } catch (error) {
        console.error(
          "Appwrite logout error:",
          error
        );
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.delete(SESSION_COOKIE);

    return response;
  } catch (error) {
    console.error(
      "Logout API error:",
      error
    );

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.delete(SESSION_COOKIE);

    return response;
  }
}