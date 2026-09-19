import { NextRequest, NextResponse } from "next/server";
import {
    Client,
    TablesDB,
} from "node-appwrite";

export async function GET(
    request: NextRequest
) {
    try {
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

        const databaseId =
            process.env
                .NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

        const tableId =
            process.env
                .NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID ||
            "members";

        const response =
            await tablesDB.listRows({
                databaseId,
                tableId,
                queries: [],
            });

        return NextResponse.json({
            success: true,
            members: response.rows,
        });
    } catch (error) {
        console.error(
            "Members API error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Unable to load HomeMate users.",
                members: [],
            },
            {
                status: 500,
            }
        );
    }
}