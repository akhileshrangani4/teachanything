import { NextRequest } from "next/server";
import { handleTranscribe } from "./handle-transcribe";

export const runtime = "nodejs";
// Provider call can take ~60s for a 3-minute clip; cap the function
// generously so it doesn't time out before the helper does.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  return handleTranscribe(request);
}
