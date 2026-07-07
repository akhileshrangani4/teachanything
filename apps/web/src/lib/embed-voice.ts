/**
 * Voice-input gating for the embedded chat window.
 *
 * In a cross-origin iframe, getUserMedia() only works when the HOST page
 * delegates access via `<iframe allow="microphone">`. That attribute lives
 * in the embedder's pasted snippet, so it can't be added from our side.
 * Voice is therefore double-gated:
 *
 * 1. The `voice=1` query param -- only present in embed snippets generated
 *    after voice input shipped, the same snippets that carry
 *    `allow="microphone"` on the iframe. Older pasted embeds have neither,
 *    so they stay text-only instead of showing a mic that can never get
 *    permission.
 * 2. The Permissions Policy API, where the browser exposes it (Chromium's
 *    `document.permissionsPolicy`, older `document.featurePolicy`). This
 *    catches snippets whose `allow` attribute was stripped in transit --
 *    some CMS editors sanitize iframe attributes. Safari and Firefox don't
 *    expose the API; there we trust the param and let the recorder's
 *    permission-denied dialog handle the rare stripped-attribute case.
 */

export interface PolicyDocument {
  permissionsPolicy?: { allowsFeature?: (feature: string) => boolean };
  featurePolicy?: { allowsFeature?: (feature: string) => boolean };
}

/**
 * Whether this document may use the microphone under the Permissions
 * Policy it was embedded with. Optimistic (true) when the browser doesn't
 * expose a policy API -- the caller's own gating decides there.
 */
export function micPermissionsPolicyAllows(doc: PolicyDocument): boolean {
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (policy && typeof policy.allowsFeature === "function") {
    try {
      return policy.allowsFeature("microphone");
    } catch {
      // An implementation that rejects the feature name must not disable
      // the button.
      return true;
    }
  }
  return true;
}

/** Full gate: `voice=1` in the embed URL AND the policy permits the mic. */
export function embedVoiceEnabled(
  search: string,
  doc: PolicyDocument,
): boolean {
  const params = new URLSearchParams(search);
  if (params.get("voice") !== "1") return false;
  return micPermissionsPolicyAllows(doc);
}
