import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    Client,
    Databases,
    ID,
    Permission,
    Query,
    Role,
} from "node-appwrite";


/* ============================================================
   APPWRITE SERVER CLIENT
============================================================ */

const client =
    new Client()
        .setEndpoint(
            process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!
        )
        .setProject(
            process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!
        )
        .setKey(
            process.env.APPWRITE_API_KEY!
        );


const databases =
    new Databases(client);


/* ============================================================
   APPWRITE CONFIGURATION
============================================================ */

const DATABASE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const MEMBERS_TABLE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
    "members";

const NOTIFICATIONS_TABLE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID ||
    "notifications";


/* ============================================================
   POST
   CREATE PROMOTIONAL NOTIFICATION
============================================================ */

export async function POST(
    request: NextRequest
) {

    try {

        const body =
            await request.json();


        const {
            title,
            message,
            userIds,
        } = body;


        /* ========================================================
           VALIDATION
        ======================================================== */

        if (
            !title ||
            !message
        ) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Title and message are required.",
                },
                {
                    status: 400,
                }
            );
        }


        /* ========================================================
           DETERMINE TARGET USERS
           
           If userIds are provided:
           → Send only to those users.

           If userIds are not provided:
           → Send to all HomeMate members.
        ======================================================== */

        let targetUserIds: string[] =
            Array.isArray(userIds)
                ? userIds.filter(
                      (
                          id: unknown
                      ): id is string =>
                          typeof id ===
                          "string" &&
                          id.trim()
                              .length > 0
                  )
                : [];


        /* ========================================================
           GET ALL MEMBERS
           Only when no specific users were selected.
        ======================================================== */

        if (
            targetUserIds.length === 0
        ) {

            const membersResponse =
                await databases.listDocuments(
                    DATABASE_ID,
                    MEMBERS_TABLE_ID,
                    [
                        Query.limit(100),
                    ]
                );


            targetUserIds =
                membersResponse.documents
                    .map(
                        (
                            member
                        ) =>
                            member.userId
                    )
                    .filter(
                        (
                            userId
                        ): userId is string =>
                            typeof userId ===
                                "string" &&
                            userId.trim()
                                .length > 0
                    );
        }


        /* ========================================================
           NO USERS FOUND
        ======================================================== */

        if (
            targetUserIds.length === 0
        ) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "No HomeMate users were found.",
                },
                {
                    status: 404,
                }
            );
        }


        /* ========================================================
           CREATE PROMOTIONAL NOTIFICATIONS
        ======================================================== */

        let createdCount = 0;


        for (
            const userId of targetUserIds
        ) {

            try {

                await databases.createDocument(
                    DATABASE_ID,
                    NOTIFICATIONS_TABLE_ID,
                    ID.unique(),

                    {
                        userId,
                        title,
                        message,
                        type:
                            "promotional",
                        isRead: false,
                        referenceId:
                            null,
                    },

                    [
                        Permission.read(
                            Role.user(
                                userId
                            )
                        ),
                        Permission.update(
                            Role.user(
                                userId
                            )
                        ),
                    ]
                );


                createdCount++;

            } catch (
                notificationError
            ) {

                console.error(
                    `Failed to create promotional notification for ${userId}:`,
                    notificationError
                );

            }
        }


        /* ========================================================
           CHECK IF ANY NOTIFICATIONS WERE CREATED
        ======================================================== */

        if (
            createdCount === 0
        ) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Promotional notifications could not be created.",
                },
                {
                    status: 500,
                }
            );
        }


        /* ========================================================
           SUCCESS RESPONSE
        ======================================================== */

        return NextResponse.json(
            {
                success: true,

                message:
                    "Promotional notification sent successfully.",

                createdCount,
            },
            {
                status: 200,
            }
        );


    } catch (error) {

        console.error(
            "Promotional notification API error:",
            error
        );


        return NextResponse.json(
            {
                success: false,
                message:
                    "Unable to send promotional notification.",
            },
            {
                status: 500,
            }
        );
    }
}