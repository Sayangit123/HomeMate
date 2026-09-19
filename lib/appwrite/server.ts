import { Account, Client, TablesDB } from "node-appwrite";

const createSessionClient = (session: string) => {
  const client = new Client();

  client
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setSession(session);

  return {
    account: new Account(client),
    tablesDB: new TablesDB(client),
  };
};

export default createSessionClient;