import { describe, it, expect } from "@jest/globals";
import {
  allocateTokenBudget,
  calculateChunkLimit,
  BUDGET_RATIO,
  CHUNK_SHARE,
  AVG_CHUNK_TOKENS,
} from "../token-budget";
import type { TokenBudgetInput } from "../token-budget";

describe("token-budget", () => {
  // Shared typical inputs (128K model, per verified research math)
  const typicalFixed = {
    contextWindow: 131_072,
    maxOutputTokens: 2000,
    systemPromptTokens: 33,
    fileManifestTokens: 78,
    userMessageTokens: 21,
  };

  describe("constants", () => {
    it("exports expected budget constants", () => {
      expect(BUDGET_RATIO).toBe(0.8);
      expect(CHUNK_SHARE).toBe(0.6);
      expect(AVG_CHUNK_TOKENS).toBe(625);
    });
  });

  describe("allocateTokenBudget", () => {
    it("returns chunkLimit > 0 and historyLimit > 0 for typical inputs", () => {
      const input: TokenBudgetInput = {
        ...typicalFixed,
        availableChunks: Array.from({ length: 20 }, () => ({ tokens: 551 })),
        availableHistory: Array.from({ length: 10 }, () => ({ tokens: 55 })),
      };

      const result = allocateTokenBudget(input);

      expect(result.chunkLimit).toBeGreaterThan(0);
      expect(result.historyLimit).toBeGreaterThan(0);
      expect(result.truncated).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it("returns chunkLimit: 0, historyLimit: 0 when fixed components exceed budget", () => {
      const input: TokenBudgetInput = {
        contextWindow: 131_072,
        maxOutputTokens: 131_072, // output reservation exceeds entire context
        systemPromptTokens: 33,
        fileManifestTokens: 78,
        userMessageTokens: 21,
        availableChunks: [{ tokens: 551 }],
        availableHistory: [{ tokens: 55 }],
      };

      const result = allocateTokenBudget(input);

      expect(result.chunkLimit).toBe(0);
      expect(result.historyLimit).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("truncates chunks when more available than budget allows", () => {
      // Create many large chunks that won't all fit
      const input: TokenBudgetInput = {
        contextWindow: 131_072,
        maxOutputTokens: 2000,
        systemPromptTokens: 33,
        fileManifestTokens: 78,
        userMessageTokens: 21,
        availableChunks: Array.from({ length: 200 }, () => ({ tokens: 551 })),
        availableHistory: Array.from({ length: 5 }, () => ({ tokens: 55 })),
      };

      const result = allocateTokenBudget(input);

      expect(result.chunkLimit).toBeLessThan(200);
      expect(result.truncated).toBe(true);
      expect(result.warnings.some((w) => w.includes("chunks"))).toBe(true);
    });

    it("truncates history when more messages than budget allows", () => {
      // Fill most of the budget with chunks, leave little for history
      const input: TokenBudgetInput = {
        contextWindow: 131_072,
        maxOutputTokens: 2000,
        systemPromptTokens: 33,
        fileManifestTokens: 78,
        userMessageTokens: 21,
        availableChunks: Array.from({ length: 90 }, () => ({ tokens: 551 })),
        availableHistory: Array.from({ length: 50 }, () => ({ tokens: 5000 })),
      };

      const result = allocateTokenBudget(input);

      expect(result.historyLimit).toBeLessThan(50);
      expect(result.truncated).toBe(true);
      expect(result.warnings.some((w) => w.includes("history"))).toBe(true);
    });

    it("preserves newest history messages (historyLimit counts from end)", () => {
      // Create history with ascending token counts so we can verify order
      const input: TokenBudgetInput = {
        contextWindow: 131_072,
        maxOutputTokens: 2000,
        systemPromptTokens: 33,
        fileManifestTokens: 78,
        userMessageTokens: 21,
        availableChunks: Array.from({ length: 90 }, () => ({ tokens: 551 })),
        // 10 history messages, each 8000 tokens -- not all will fit
        availableHistory: Array.from({ length: 10 }, () => ({
          tokens: 8000,
        })),
      };

      const result = allocateTokenBudget(input);

      // historyLimit means "keep the last N" -- verify it's less than total
      expect(result.historyLimit).toBeLessThan(10);
      expect(result.historyLimit).toBeGreaterThanOrEqual(0);

      // Simulate what the caller does: slice from end
      const history = Array.from({ length: 10 }, (_, i) => `msg-${i}`);
      const kept = history.slice(history.length - result.historyLimit);
      // The kept messages should be the newest ones (highest indices)
      if (result.historyLimit > 0) {
        expect(kept[kept.length - 1]).toBe("msg-9"); // newest preserved
      }
    });

    it("totalInputTokens equals sum of fixed + actual chunks kept + actual history kept", () => {
      const input: TokenBudgetInput = {
        ...typicalFixed,
        availableChunks: Array.from({ length: 20 }, () => ({ tokens: 551 })),
        availableHistory: Array.from({ length: 10 }, () => ({ tokens: 55 })),
      };

      const result = allocateTokenBudget(input);

      const fixedTokens =
        typicalFixed.systemPromptTokens +
        typicalFixed.fileManifestTokens +
        typicalFixed.userMessageTokens;
      const chunkTokens = result.chunkLimit * 551;
      const historyTokens = result.historyLimit * 55;

      expect(result.totalInputTokens).toBe(
        fixedTokens + chunkTokens + historyTokens,
      );
    });

    it("handles empty chunks and empty history arrays", () => {
      const input: TokenBudgetInput = {
        ...typicalFixed,
        availableChunks: [],
        availableHistory: [],
      };

      const result = allocateTokenBudget(input);

      expect(result.chunkLimit).toBe(0);
      expect(result.historyLimit).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it("budgetCapacity equals floor(contextWindow * 0.8) - maxOutputTokens", () => {
      const input: TokenBudgetInput = {
        ...typicalFixed,
        availableChunks: Array.from({ length: 5 }, () => ({ tokens: 551 })),
        availableHistory: Array.from({ length: 5 }, () => ({ tokens: 55 })),
      };

      const result = allocateTokenBudget(input);

      const expected =
        Math.floor(typicalFixed.contextWindow * BUDGET_RATIO) -
        typicalFixed.maxOutputTokens;
      expect(result.budgetCapacity).toBe(expected);
    });
  });

  describe("calculateChunkLimit", () => {
    it("returns ~98 for 128K model with typical fixed costs", () => {
      const result = calculateChunkLimit(typicalFixed);
      // inputBudget = floor(131072 * 0.8) - 2000 = 104857 - 2000 = 102857
      // remaining = 102857 - 33 - 78 - 21 = 102725
      // chunkBudget = floor(102725 * 0.6) = 61635
      // chunkLimit = floor(61635 / 625) = 98
      expect(result).toBe(98);
    });

    it("returns ~199 for 262K model with typical fixed costs", () => {
      const result = calculateChunkLimit({
        ...typicalFixed,
        contextWindow: 262_144,
      });
      // inputBudget = floor(262144 * 0.8) - 2000 = 209715 - 2000 = 207715
      // remaining = 207715 - 33 - 78 - 21 = 207583
      // chunkBudget = floor(207583 * 0.6) = 124549
      // chunkLimit = floor(124549 / 625) = 199
      expect(result).toBe(199);
    });

    it("returns ~803 for 1M model with typical fixed costs", () => {
      const result = calculateChunkLimit({
        ...typicalFixed,
        contextWindow: 1_048_576,
      });
      // inputBudget = floor(1048576 * 0.8) - 2000 = 838860 - 2000 = 836860
      // remaining = 836860 - 33 - 78 - 21 = 836728
      // chunkBudget = floor(836728 * 0.6) = 502036
      // chunkLimit = floor(502036 / 625) = 803
      expect(result).toBe(803);
    });

    it("clamps to 0 when fixed costs exceed budget", () => {
      const result = calculateChunkLimit({
        contextWindow: 131_072,
        maxOutputTokens: 131_072, // exceeds entire context window
        systemPromptTokens: 1000,
        fileManifestTokens: 1000,
        userMessageTokens: 1000,
      });
      expect(result).toBe(0);
    });
  });
});
