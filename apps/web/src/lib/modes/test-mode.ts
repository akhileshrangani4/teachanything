import {
  isTestRequest,
  testSchema,
  TEST_SYSTEM_INSTRUCTION,
  type Test,
} from "@/lib/test-mode";
import type { StructuredMode } from "./types";

export const testMode: StructuredMode<Test> = {
  id: "test",
  label: "test",
  detect: isTestRequest,
  canonicalTrigger: (topic) => (topic ? `test me on ${topic}` : "test me"),
  instruction: TEST_SYSTEM_INSTRUCTION,
  schema: testSchema,
  summarize: (t) => `Test: ${t.test_title}`,
  fallbackMessage:
    "Sorry, I couldn't put a test together just now. Please try asking me for a test again.",
};
