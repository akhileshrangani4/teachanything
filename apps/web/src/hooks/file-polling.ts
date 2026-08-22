/**
 * Builds a `refetchInterval` callback for file queries.
 * Polls while any file is pending/processing and stops when done.
 *
 * Not a hook (no internal state) — call it where you build query options:
 *
 * @example
 * ```tsx
 * const { data: filesData } = trpc.files.list.useQuery(
 *   { limit: 10, offset: 0 },
 *   {
 *     refetchInterval: getFilePollingInterval(),
 *   }
 * );
 * // Access files via filesData?.files
 * ```
 */
export function getFilePollingInterval(pollInterval: number = 2000) {
  return (query: {
    state: {
      data?:
        | Array<{ processingStatus: string }>
        | { files: Array<{ processingStatus: string }>; totalCount: number }
        | undefined;
    };
  }) => {
    // Check if any files are processing and poll accordingly
    const data = query.state.data;

    // Handle both old format (array) and new format (object with files array)
    let files: Array<{ processingStatus: string }> | undefined;
    if (Array.isArray(data)) {
      files = data;
    } else if (data && typeof data === "object" && "files" in data) {
      files = data.files;
    }

    const hasProcessingFiles = files?.some(
      (f) =>
        f.processingStatus === "pending" || f.processingStatus === "processing",
    );
    return hasProcessingFiles ? pollInterval : false;
  };
}
