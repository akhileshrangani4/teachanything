import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Turn one chatbot off for students, or back on. The confirmation names the
 * chatbot and offers Undo, since a pause takes effect for students at once.
 */
export function useSetChatbotPaused() {
  const utils = trpc.useUtils();
  const mutation = trpc.admin.setChatbotPaused.useMutation({
    onSettled: () => void utils.admin.invalidate(),
    onError: (error) => {
      toast.error("Failed to update chatbot", { description: error.message });
    },
  });

  function setPaused(chatbot: { id: string; name: string }, paused: boolean) {
    mutation.mutate(
      { chatbotId: chatbot.id, paused },
      {
        onSuccess: () => {
          toast.success(
            paused
              ? `Paused "${chatbot.name}". Students now see it as unavailable.`
              : `"${chatbot.name}" is available to students again.`,
            {
              action: {
                label: "Undo",
                onClick: () => setPaused(chatbot, !paused),
              },
            },
          );
        },
      },
    );
  }

  return { setPaused, isPending: mutation.isPending };
}
