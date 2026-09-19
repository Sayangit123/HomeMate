import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    Account,
    Client,
} from "node-appwrite";


export async function POST(
    request: NextRequest
) {

    try {

        const {
            email,
            password,
        } = await request.json();


        /* =====================================================
           VALIDATION
        ===================================================== */

        if (!email || !password) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Email and password are required.",
                },
                {
                    status: 400,
                }
            );
        }


        /* =====================================================
           APPWRITE SERVER CLIENT
        ===================================================== */

        const client =
            new Client()
                .setEndpoint(
                    process.env
                        .NEXT_PUBLIC_APPWRITE_ENDPOINT!
                )
                .setProject(
                    process.env
                        .NEXT_PUBLIC_APPWRITE_PROJECT_ID!
                )
                .setKey(
                    process.env
                        .APPWRITE_API_KEY!
                );


        const account =
            new Account(client);


        /* =====================================================
           CREATE SERVER SESSION
        ===================================================== */

        const session =
            await account.createEmailPasswordSession(
                email,
                password
            );


        /* =====================================================
           RESPONSE
        ===================================================== */

        const response =
            NextResponse.json({

                success: true,

                message:
                    "Login successful.",
            });


        /* =====================================================
           HOMEmATE SESSION COOKIE
        ===================================================== */

        response.cookies.set(
            "homemate-session",
            session.secret,
            {
                httpOnly: true,

                secure:
                    process.env.NODE_ENV ===
                    "production",

                sameSite: "lax",

                path: "/",
            }
        );


        return response;


    } catch (error) {

        console.error(
            "Login API error:",
            error
        );


        return NextResponse.json(
            {
                success: false,
                message:
                    "Invalid email or password.",
            },
            {
                status: 401,
            }
        );
    }
}