import { Account, ID } from "appwrite";

import client from "./client";

const account = new Account(client);

export const createAccount = async (
  email: string,
  password: string,
  name: string
) => {
  return await account.create(
    ID.unique(),
    email,
    password,
    name
  );
};

export const loginAccount = async (
  email: string,
  password: string
) => {
  // Remove an existing session if one exists
  try {
    await account.deleteSession("current");
  } catch {
    // No active session, so continue with login
  }

  return await account.createEmailPasswordSession(
    email,
    password
  );
};

export const getCurrentUser = async () => {
  return await account.get();
};

export const logoutAccount = async () => {
  return await account.deleteSession("current");
};

export default account;