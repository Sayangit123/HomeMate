import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    Client,
    Databases,
    ID,
    Permission,
    Role,
    Query,
    TablesDB,
} from "node-appwrite";

export async function POST(
    request: NextRequest
) {
    try {
        const body = await request.json();

        const {
            title,
            message,
            audience,
            selectedUsers,
        } = body;

        /* ========================================================
           VALIDATION
        ======================================================== */

        if (!title?.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Announcement title is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (!message?.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Announcement message is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            audience !== "everyone" &&
            audience !== "selected"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid announcement audience.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            audience === "selected" &&
            (!Array.isArray(selectedUsers) ||
                selectedUsers.length === 0)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Please select at least one user.",
                },
                {
                    status: 400,
                }
            );
        }

        /* ========================================================
           APPWRITE CLIENT
        ======================================================== */

        const client = new Client()
            .setEndpoint(
                process.env
                    .NEXT_PUBLIC_APPWRITE_ENDPOINT!
            )
            .setProject(
                process.env
                    .NEXT_PUBLIC_APPWRITE_PROJECT_ID!
            )
            .setKey(
                process.env.APPWRITE_API_KEY!
            );

        const tablesDB =
            new TablesDB(client);

        const databases =
            new Databases(client);

        const databaseId =
            process.env
                .NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

        const membersTableId =
            process.env
                .NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
            "members";

        const notificationsTableId =
            process.env
                .NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_TABLE_ID ||
            "notifications";

        /* ========================================================
           GET RECIPIENT MEMBERS
        ======================================================== */

        let recipientMembers: any[] = [];

        if (audience === "everyone") {
            const membersResponse =
                await tablesDB.listRows({
                    databaseId,
                    tableId:
                        membersTableId,
                    queries: [
                        Query.limit(100),
                    ],
                });

            recipientMembers =
                membersResponse.rows;
        } else {
            /*
             * selectedUsers contains MEMBER ROW IDs.
             *
             * We convert those member IDs into
             * Appwrite authentication user IDs.
             */

            const selectedIds =
                Array.isArray(
                    selectedUsers
                )
                    ? selectedUsers
                    : [];

            for (
                const memberId of selectedIds
            ) {
                try {
                    const member =
                        await tablesDB.getRow({
                            databaseId,
                            tableId:
                                membersTableId,
                            rowId:
                                memberId,
                        });

                    recipientMembers.push(
                        member
                    );
                } catch (error) {
                    console.error(
                        `Unable to load member ${memberId}:`,
                        error
                    );
                }
            }
        }

        /* ========================================================
           REMOVE INVALID MEMBERS
        ======================================================== */

        recipientMembers =
            recipientMembers.filter(
                (member) =>
                    member?.userId
            );

        if (
            recipientMembers.length ===
            0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "No valid recipients were found.",
                },
                {
                    status: 400,
                }
            );
        }

        /* ========================================================
           CREATE NOTIFICATIONS
        ======================================================== */

        let createdCount = 0;

        const failedRecipients: string[] =
            [];

        for (
            const member of recipientMembers
        ) {
            try {
                await databases.createDocument(
                    databaseId,
                    notificationsTableId,
                    ID.unique(),
                    {
                        userId:
                            member.userId,

                        title:
                            title.trim(),

                        message:
                            message.trim(),

                        type:
                            "system",

                        isRead:
                            false,

                        referenceId:
                            null,
                    },
                    [
                        Permission.read(
                            Role.user(
                                member.userId
                            )
                        ),
                        Permission.update(
                            Role.user(
                                member.userId
                            )
                        ),
                        Permission.delete(
                            Role.user(
                                member.userId
                            )
                        ),
                    ]
                );

                createdCount++;
            } catch (error) {
                console.error(
                    `Notification creation failed for ${member.userId}:`,
                    error
                );

                failedRecipients.push(
                    member.userId
                );
            }
        }

        /* ========================================================
           RESPONSE
        ======================================================== */

        if (createdCount === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Unable to create system announcements.",
                    createdCount: 0,
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "System announcement published successfully.",
            createdCount,
            totalRecipients:
                recipientMembers.length,
            failedCount:
                failedRecipients.length,
        });
    } catch (error) {
        console.error(
            "System announcement API error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Unable to publish system announcement.",
            },
            {
                status: 500,
            }
        );
    }
}