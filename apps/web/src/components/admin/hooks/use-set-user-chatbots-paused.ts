import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Turn all of one professor's chatbots off for students, or back on. The
 * confirmation names the professor and offers Undo.
 */
export function useSetUserChatbotsPaused() {
  const utils = trpc.useUtils();
  const mutation = trpc.admin.setUserChatbotsPaused.useMutation({
    onSettled: () => void utils.admin.invalidate(),
    onError: (error) => {
      toast.error("Failed to update chatbots", { description: error.message });
    },
  });

  function setPaused(professor: { id: string; name: string }, paused: boolean) {
    mutation.mutate(
      { userId: professor.id, paused },
      {
        onSuccess: () => {
          toast.success(
            paused
              ? `Paused all of ${professor.name}'s chatbots. Students now see them as unavailable.`
              : `${professor.name}'s chatbots are available to students again.`,
            {
              action: {
                label: "Undo",
                onClick: () => setPaused(professor, !paused),
              },
            },
          );
        },
      },
    );
  }

  return { setPaused, isPending: mutation.isPending };
}
