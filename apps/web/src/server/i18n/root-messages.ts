import en from "../../../messages/en.json";
import type { Messages } from "@/i18n/create-i18n";

/** English namespaces the root (English-only) provider needs. */
const ROOT_NAMESPACES = ["common", "nav", "chat", "errors"] as const;

export function getRootMessages(): Messages {
  return Object.fromEntries(ROOT_NAMESPACES.map((ns) => [ns, en[ns]]));
}
