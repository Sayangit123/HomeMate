import { ID, Query, TablesDB } from "appwrite";

import client from "./client";
import { APPWRITE_CONFIG } from "./config";

const tablesDB = new TablesDB(client);

export interface MemberRow {
  $id: string;
  $createdAt: string;
  $updatedAt: string;

  userId: string;
  fullName: string;
  phone: string | null;

  role:
    | "customer"
    | "professional"
    | "business"
    | "admin";

  profileImage: string | null;

  profileCompletion: number;

  verificationStatus:
    | "Pending"
    | "Approved"
    | "Rejected";

  licenseDocument: string | null;

  certificateDocument: string | null;

  verificationSubmittedAt: string | null;
}

/*
|--------------------------------------------------------------------------
| Create Member
|--------------------------------------------------------------------------
*/

export const createMember = async (data: {
  userId: string;
  fullName: string;
  phone: string;
  role:
    | "customer"
    | "professional"
    | "business"
    | "admin";
  profileImage: string | null;
}) => {
  return await tablesDB.createRow({
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.membersTableId,
    rowId: ID.unique(),

    data: {
      userId: data.userId,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role,
      profileImage: data.profileImage,
      profileCompletion: 0,
      verificationStatus: "Pending",
    },
  });
};

/*
|--------------------------------------------------------------------------
| Update Profile Completion
|--------------------------------------------------------------------------
*/

export const updateMemberProfileCompletion = async (
  rowId: string,
  profileCompletion: number
) => {
  return await tablesDB.updateRow({
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.membersTableId,
    rowId,

    data: {
      profileCompletion,
    },
  });
};

/*
|--------------------------------------------------------------------------
| Update Professional Verification
|--------------------------------------------------------------------------
*/

export const updateMemberVerification = async (
  rowId: string,
  data: {
    licenseDocument: string | null;
    certificateDocument: string | null;
    verificationSubmittedAt: string;
    verificationStatus: "Pending";
  }
) => {
  return await tablesDB.updateRow({
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.membersTableId,
    rowId,

    data: {
      licenseDocument: data.licenseDocument,
      certificateDocument: data.certificateDocument,
      verificationSubmittedAt:
        data.verificationSubmittedAt,
      verificationStatus:
        data.verificationStatus,
    },
  });
};

/*
|--------------------------------------------------------------------------
| Get Current User's Member Profile
|--------------------------------------------------------------------------
*/

export const getCurrentMember = async (
  userId: string
): Promise<MemberRow | null> => {
  const response = await tablesDB.listRows({
    databaseId: APPWRITE_CONFIG.databaseId,
    tableId: APPWRITE_CONFIG.membersTableId,

    queries: [
      Query.equal("userId", userId),
      Query.limit(1),
    ],
  });

  const row = response.rows[0];

  if (!row) {
    return null;
  }

  return {
    $id: String(row.$id),

    $createdAt: String(row.$createdAt),

    $updatedAt: String(row.$updatedAt),

    userId: String(row.userId),

    fullName: String(row.fullName),

    phone: row.phone
      ? String(row.phone)
      : null,

    role: row.role as
      | "customer"
      | "professional"
      | "business"
      | "admin",

    profileImage: row.profileImage
      ? String(row.profileImage)
      : null,

    profileCompletion: Number(
      row.profileCompletion
    ),

    verificationStatus:
      row.verificationStatus as
        | "Pending"
        | "Approved"
        | "Rejected",

    licenseDocument:
      row.licenseDocument
        ? String(row.licenseDocument)
        : null,

    certificateDocument:
      row.certificateDocument
        ? String(row.certificateDocument)
        : null,

    verificationSubmittedAt:
      row.verificationSubmittedAt
        ? String(row.verificationSubmittedAt)
        : null,
  };
};

export default tablesDB;