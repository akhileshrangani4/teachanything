import {
  user,
  session,
  chatbots,
  userStatusEnum,
  userRoleEnum,
  processingStatusEnum,
} from "../schema";

describe("Database Schema", () => {
  describe("Enums", () => {
    it("defines userStatusEnum with correct values", () => {
      expect(userStatusEnum.enumValues).toEqual([
        "pending",
        "approved",
        "rejected",
      ]);
    });

    it("defines userRoleEnum with correct values", () => {
      expect(userRoleEnum.enumValues).toEqual(["user", "admin"]);
    });

    it("defines processingStatusEnum with correct values", () => {
      expect(processingStatusEnum.enumValues).toEqual([
        "pending",
        "processing",
        "completed",
        "failed",
      ]);
    });
  });

  describe("Tables", () => {
    it("defines user table with required columns", () => {
      const columns = Object.keys(user);
      expect(columns).toContain("id");
      expect(columns).toContain("email");
      expect(columns).toContain("name");
      expect(columns).toContain("status");
      expect(columns).toContain("role");
      expect(columns).toContain("createdAt");
    });

    it("defines session table with required columns", () => {
      const columns = Object.keys(session);
      expect(columns).toContain("id");
      expect(columns).toContain("userId");
      expect(columns).toContain("token");
      expect(columns).toContain("expiresAt");
    });

    it("defines chatbots table with required columns", () => {
      const columns = Object.keys(chatbots);
      expect(columns).toContain("id");
      expect(columns).toContain("userId");
      expect(columns).toContain("name");
    });
  });
});
