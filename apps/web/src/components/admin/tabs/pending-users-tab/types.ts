export type PendingUser = {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  institutionalAffiliation: string | null;
  department: string | null;
  facultyWebpage: string | null;
  country: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

export interface UserDialogState {
  isOpen: boolean;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

export const EMPTY_USER_DIALOG: UserDialogState = {
  isOpen: false,
  userId: null,
  userName: null,
  userEmail: null,
};
