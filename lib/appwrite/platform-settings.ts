import { Databases, Query } from "appwrite";

import client from "./client";

const databases = new Databases(client);

const DATABASE_ID =
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const PLATFORM_SETTINGS_TABLE_ID =
    process.env
        .NEXT_PUBLIC_APPWRITE_PLATFORM_SETTINGS_TABLE_ID ||
    "platform_settings";

export interface PlatformSettings {
    $id: string;
    $createdAt?: string;
    $updatedAt?: string;

    platformName: string;
    platformEmail: string;
    platformPhone?: string | null;

    maintenanceMode: boolean;
    allowRegistrations: boolean;
    allowBookings: boolean;

    commissionRate: number;

    supportMessage?: string | null;
}

export interface UpdatePlatformSettingsData {
    platformName?: string;
    platformEmail?: string;
    platformPhone?: string;
    maintenanceMode?: boolean;
    allowRegistrations?: boolean;
    allowBookings?: boolean;
    commissionRate?: number;
    supportMessage?: string;
}

/**
 * Get the single platform settings document.
 */
export const getPlatformSettings =
    async (): Promise<PlatformSettings> => {
        const response =
            await databases.listDocuments(
                DATABASE_ID,
                PLATFORM_SETTINGS_TABLE_ID,
                [
                    Query.limit(1),
                ]
            );

        if (!response.documents.length) {
            throw new Error(
                "Platform settings document not found."
            );
        }

        return response.documents[0] as unknown as PlatformSettings;
    };

/**
 * Get settings directly by document ID.
 */
export const getPlatformSettingsById =
    async (
        settingsId: string
    ): Promise<PlatformSettings> => {
        const response =
            await databases.getDocument(
                DATABASE_ID,
                PLATFORM_SETTINGS_TABLE_ID,
                settingsId
            );

        return response as unknown as PlatformSettings;
    };

/**
 * Update platform settings.
 */
export const updatePlatformSettings =
    async (
        settingsId: string,
        data: UpdatePlatformSettingsData
    ): Promise<PlatformSettings> => {
        const response =
            await databases.updateDocument(
                DATABASE_ID,
                PLATFORM_SETTINGS_TABLE_ID,
                settingsId,
                data
            );

        return response as unknown as PlatformSettings;
    };