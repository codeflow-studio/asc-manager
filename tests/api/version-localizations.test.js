import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchVersionLocalizations,
  createVersionLocalization,
  updateVersionLocalization,
  deleteVersionLocalization,
} from "../../src/api/index.js";

const MOCK_LOC = {
  id: "loc-1",
  locale: "en-US",
  description: "Test",
  whatsNew: "Fixes",
  keywords: "test",
  promotionalText: "",
  supportUrl: "",
  marketingUrl: "",
};

describe("Version Localization API functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchVersionLocalizations", () => {
    it("fetches localizations with correct URL and query params", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([MOCK_LOC]),
      });

      const result = await fetchVersionLocalizations("app-1", "ver-1", "acc-1");

      expect(result).toEqual([MOCK_LOC]);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/apps/app-1/versions/ver-1/localizations?accountId=acc-1"
      );
    });

    it("throws on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

      await expect(fetchVersionLocalizations("app-1", "ver-1", "acc-1"))
        .rejects.toThrow("Failed to fetch version localizations: 502");
    });
  });

  describe("createVersionLocalization", () => {
    it("sends POST with locale and fields", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_LOC),
      });

      const result = await createVersionLocalization("app-1", "ver-1", {
        accountId: "acc-1",
        locale: "en-US",
        description: "Test",
      });

      expect(result).toEqual(MOCK_LOC);
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe("/api/apps/app-1/versions/ver-1/localizations");
      expect(opts.method).toBe("POST");
      const body = JSON.parse(opts.body);
      expect(body.accountId).toBe("acc-1");
      expect(body.locale).toBe("en-US");
      expect(body.description).toBe("Test");
    });

    it("throws with server error message on failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid locale" }),
      });

      await expect(
        createVersionLocalization("app-1", "ver-1", { accountId: "acc-1", locale: "bad" })
      ).rejects.toThrow("Invalid locale");
    });

    it("throws generic message when error body is not JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("not json")),
      });

      await expect(
        createVersionLocalization("app-1", "ver-1", { accountId: "acc-1", locale: "en" })
      ).rejects.toThrow("Failed to create version localization: 500");
    });
  });

  describe("updateVersionLocalization", () => {
    it("sends PATCH with fields", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_LOC),
      });

      const result = await updateVersionLocalization("app-1", "ver-1", "loc-1", {
        accountId: "acc-1",
        description: "Updated",
        whatsNew: "New stuff",
      });

      expect(result).toEqual(MOCK_LOC);
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe("/api/apps/app-1/versions/ver-1/localizations/loc-1");
      expect(opts.method).toBe("PATCH");
      const body = JSON.parse(opts.body);
      expect(body.accountId).toBe("acc-1");
      expect(body.description).toBe("Updated");
      expect(body.whatsNew).toBe("New stuff");
    });

    it("throws with server error on failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: "ASC error" }),
      });

      await expect(
        updateVersionLocalization("app-1", "ver-1", "loc-1", { accountId: "acc-1" })
      ).rejects.toThrow("ASC error");
    });
  });

  describe("deleteVersionLocalization", () => {
    it("sends DELETE with accountId as query param", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await deleteVersionLocalization("app-1", "ver-1", "loc-1", "acc-1");

      expect(result).toEqual({ success: true });
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe("/api/apps/app-1/versions/ver-1/localizations/loc-1?accountId=acc-1");
      expect(opts.method).toBe("DELETE");
    });

    it("throws with server error on failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: "Cannot delete primary locale" }),
      });

      await expect(
        deleteVersionLocalization("app-1", "ver-1", "loc-1", "acc-1")
      ).rejects.toThrow("Cannot delete primary locale");
    });
  });
});
