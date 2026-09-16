/**
 * Custom columns Better Auth carries on the user model, beyond its own.
 *
 * Lives in its own module, apart from `config.ts`, so tests can read it
 * without importing the auth instance (which pulls in env, the database and
 * the email client at module load). `auth-schema.test.ts` needs exactly this
 * to work out which columns Better Auth expects our tables to have.
 */
export const userAdditionalFields = {
  role: {
    type: "string",
    required: true,
    defaultValue: "user",
  },
  status: {
    type: "string",
    required: true,
    defaultValue: "pending",
  },
  // Verification fields (optional in auth config, required at registration via client-side validation)
  title: {
    type: "string",
    required: false,
  },
  institutionalAffiliation: {
    type: "string",
    required: false, // Nullable in DB for existing users; enforced at registration
  },
  department: {
    type: "string",
    required: false, // Nullable in DB for existing users; enforced at registration
  },
  facultyWebpage: {
    type: "string",
    required: false,
  },
  country: {
    type: "string",
    required: false,
  },
} as const;
