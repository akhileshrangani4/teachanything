import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** Admin mutation that turns all of one professor's chatbots off or on. */
export function useSetUserChatbotsPaused() {
  const utils = trpc.useUtils();
  return trpc.admin.setUserChatbotsPaused.useMutation({
    onSuccess: (_data, { paused }) => {
      void utils.admin.getAllUsers.invalidate();
      toast.success(paused ? "Chatbots paused" : "Chatbots resumed");
    },
    onError: (error) => {
      toast.error("Failed to update chatbots", { description: error.message });
    },
  });
}
