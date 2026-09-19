export const APPWRITE_CONFIG = {
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
  membersTableId: process.env.NEXT_PUBLIC_APPWRITE_MEMBERS_TABLE_ID!,
  propertiesTableId:
    process.env.NEXT_PUBLIC_APPWRITE_PROPERTIES_TABLE_ID || "properties",
};