import { getAdminContactEmail } from "@/server/email/support-email";
import { ChatbotsPage } from "./chatbots-page";

/**
 * Server entry for the chatbots list, so the support card's contact address
 * (which can fall back to the server-only `ADMIN_EMAILS`) never needs server
 * env in the browser.
 */
export default function Page() {
  return <ChatbotsPage contactEmail={getAdminContactEmail()} />;
}
