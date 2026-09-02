import { adminProcedure } from "@/server/trpc";
import {
  user,
  approvedDomains,
  chatbots,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import { sql, desc, eq } from "drizzle-orm";

/**
 * Export all admin data for Excel download
 * Returns all users (excluding pending), chatbots, and domains
 */
export const exportAdminDataProcedure = adminProcedure.query(
  async ({ ctx }) => {
    // Get all non-pending users
    const allUsers = await ctx.db
      .select({
        name: user.name,
        email: user.email,
        title: user.title,
        institutionalAffiliation: user.institutionalAffiliation,
        department: user.department,
        facultyWebpage: user.facultyWebpage,
        country: user.country,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(sql`${user.status} != 'pending'`)
      .orderBy(desc(user.createdAt));

    // Get all chatbots with owner info and file counts
    const allChatbots = await ctx.db
      .select({
        name: chatbots.name,
        description: chatbots.description,
        model: chatbots.model,
        ownerName: user.name,
        ownerEmail: user.email,
        featured: chatbots.featured,
        sharingEnabled: chatbots.sharingEnabled,
        customAuthorName: chatbots.customAuthorName,
        fileCount: sql<number>`cast(count(distinct ${chatbotFileAssociations.id}) as int)`,
        createdAt: chatbots.createdAt,
      })
      .from(chatbots)
      .leftJoin(user, eq(chatbots.userId, user.id))
      .leftJoin(
        chatbotFileAssociations,
        eq(chatbots.id, chatbotFileAssociations.chatbotId),
      )
      .groupBy(chatbots.id, user.id)
      .orderBy(desc(chatbots.createdAt));

    // Get all approved domains
    const allDomains = await ctx.db
      .select({
        domain: approvedDomains.domain,
        createdAt: approvedDomains.createdAt,
      })
      .from(approvedDomains)
      .orderBy(desc(approvedDomains.createdAt));

    return { users: allUsers, chatbots: allChatbots, domains: allDomains };
  },
);
