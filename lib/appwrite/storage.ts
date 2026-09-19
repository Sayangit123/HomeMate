import { ID, Storage } from "appwrite";

import client from "./client";

const storage = new Storage(client);

const HOME_MATE_BUCKET_ID = "home-mate-profiles";

// ==============================
// Profile Image
// ==============================

export const uploadProfileImage = async (file: File) => {
  const uploadedFile = await storage.createFile({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId: ID.unique(),
    file,
  });

  return uploadedFile;
};

export const getProfileImageUrl = (fileId: string) => {
  return storage.getFileView({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId,
  });
};

export const deleteProfileImage = async (fileId: string) => {
  return await storage.deleteFile({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId,
  });
};

// ==============================
// Professional Verification Documents
// ==============================

export const uploadVerificationDocument = async (
  file: File
) => {
  const uploadedFile = await storage.createFile({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId: ID.unique(),
    file,
  });

  return uploadedFile;
};

export const getVerificationDocumentUrl = (
  fileId: string
) => {
  return storage.getFileView({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId,
  });
};

export const deleteVerificationDocument = async (
  fileId: string
) => {
  return await storage.deleteFile({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId,
  });
};

// ==============================
// Property Images
// ==============================

export const uploadPropertyImage = async (
  file: File
) => {
  const uploadedFile = await storage.createFile({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId: ID.unique(),
    file,
  });

  return uploadedFile;
};

export const getPropertyImageUrl = (
  fileId: string
) => {
  return `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${HOME_MATE_BUCKET_ID}/files/${fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
};

export const deletePropertyImage = async (
  fileId: string
) => {
  return await storage.deleteFile({
    bucketId: HOME_MATE_BUCKET_ID,
    fileId,
  });
};

export default storage;