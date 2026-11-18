import { publicProcedure, protectedProcedure } from "@/server/trpc";

/**
 * Get current user status
 */
export const getStatusProcedure = publicProcedure.query(async ({ ctx }) => {
  if (!ctx.session || !ctx.session.user) {
    return {
      authenticated: false,
      user: null,
    };
  }

  const user = ctx.session.user;
  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
  };
});

/**
 * Check if user's account is approved
 */
export const checkApprovalStatusProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const user = ctx.session.user;
    return {
      status: user.status,
      isApproved: user.status === "approved",
      isPending: user.status === "pending",
      isRejected: user.status === "rejected",
    };
  },
);
