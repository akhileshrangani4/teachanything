import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** Admin mutation that turns one chatbot off for students, or back on. */
export function useSetChatbotPaused(onSuccess: () => void) {
  return trpc.admin.setChatbotPaused.useMutation({
    onSuccess: (_data, { paused }) => {
      onSuccess();
      toast.success(paused ? "Chatbot paused" : "Chatbot resumed");
    },
    onError: (error) => {
      toast.error("Failed to update chatbot", { description: error.message });
    },
  });
}
