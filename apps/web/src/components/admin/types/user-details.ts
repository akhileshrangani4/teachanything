import type { InferSelectModel } from "drizzle-orm";
import type { user } from "@teachanything/db/schema";

// User type inferred from the database schema
export type User = InferSelectModel<typeof user>;

// Pick only the fields needed for the details dialog
export type UserDetailsData = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "title"
  | "institutionalAffiliation"
  | "department"
  | "facultyWebpage"
  | "country"
  | "status"
  | "createdAt"
>;

export interface UserDetailsDialogState {
  isOpen: boolean;
  user: UserDetailsData | null;
}
