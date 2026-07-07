import { describe, it, expect } from "@jest/globals";
import {
  embedVoiceEnabled,
  micPermissionsPolicyAllows,
  type PolicyDocument,
} from "@/lib/embed-voice";

const allowingDoc: PolicyDocument = {
  permissionsPolicy: { allowsFeature: () => true },
};
const denyingDoc: PolicyDocument = {
  permissionsPolicy: { allowsFeature: () => false },
};
const noPolicyDoc: PolicyDocument = {};

describe("micPermissionsPolicyAllows", () => {
  it("returns the policy's answer when the API is available", () => {
    expect(micPermissionsPolicyAllows(allowingDoc)).toBe(true);
    expect(micPermissionsPolicyAllows(denyingDoc)).toBe(false);
  });

  it("falls back to legacy featurePolicy when permissionsPolicy is absent", () => {
    expect(
      micPermissionsPolicyAllows({
        featurePolicy: { allowsFeature: () => false },
      }),
    ).toBe(false);
    expect(
      micPermissionsPolicyAllows({
        featurePolicy: { allowsFeature: () => true },
      }),
    ).toBe(true);
  });

  it("is optimistic when no policy API exists (Safari/Firefox)", () => {
    expect(micPermissionsPolicyAllows(noPolicyDoc)).toBe(true);
  });

  it("is optimistic when allowsFeature throws on the feature name", () => {
    expect(
      micPermissionsPolicyAllows({
        permissionsPolicy: {
          allowsFeature: () => {
            throw new TypeError("unrecognized feature");
          },
        },
      }),
    ).toBe(true);
  });
});

describe("embedVoiceEnabled", () => {
  it("requires the voice=1 param even when the policy allows the mic", () => {
    expect(embedVoiceEnabled("?chatbox=false", allowingDoc)).toBe(false);
    expect(embedVoiceEnabled("", allowingDoc)).toBe(false);
  });

  it("rejects other values of the voice param", () => {
    expect(embedVoiceEnabled("?voice=true", allowingDoc)).toBe(false);
    expect(embedVoiceEnabled("?voice=0", allowingDoc)).toBe(false);
  });

  it("enables voice when the param is set and the policy allows", () => {
    expect(
      embedVoiceEnabled("?chatbox=false&withExitX=true&voice=1", allowingDoc),
    ).toBe(true);
  });

  it("disables voice when the host stripped the allow attribute (policy denies)", () => {
    expect(embedVoiceEnabled("?voice=1", denyingDoc)).toBe(false);
  });

  it("trusts the param on browsers without a policy API", () => {
    expect(embedVoiceEnabled("?voice=1", noPolicyDoc)).toBe(true);
  });
});
