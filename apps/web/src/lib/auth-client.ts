import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        // Server-managed fields (not user input)
        role: { type: "string", input: false },
        status: { type: "string", input: false },
        // Verification fields
        title: { type: "string", required: false },
        institutionalAffiliation: { type: "string" },
        department: { type: "string" },
        country: { type: "string", required: false },
        facultyWebpage: { type: "string", required: false },
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;

export type Session = typeof authClient.$Infer.Session;
export type ExtendedUser = Session["user"];
