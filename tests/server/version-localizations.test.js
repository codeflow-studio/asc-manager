import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies before importing the router
vi.mock("../../server/lib/account-store.js", () => ({
  getAccounts: vi.fn(() => [
    { id: "acc-1", name: "Test Account" },
  ]),
}));

vi.mock("../../server/lib/asc-client.js", () => ({
  ascFetch: vi.fn(),
}));

vi.mock("../../server/lib/cache.js", () => {
  const store = new Map();
  return {
    apiCache: {
      get: vi.fn((key) => store.get(key)),
      set: vi.fn((key, val) => store.set(key, val)),
      delete: vi.fn((key) => store.delete(key)),
      deleteByPrefix: vi.fn((prefix) => {
        for (const key of store.keys()) {
          if (key.startsWith(prefix)) store.delete(key);
        }
      }),
      _store: store,
    },
  };
});

import appsRouter from "../../server/routes/apps.js";
import { ascFetch } from "../../server/lib/asc-client.js";
import { apiCache } from "../../server/lib/cache.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/apps", appsRouter);
  return app;
}

const MOCK_ASC_LOC = {
  id: "loc-1",
  type: "appStoreVersionLocalizations",
  attributes: {
    locale: "en-US",
    description: "Test description",
    whatsNew: "Bug fixes",
    keywords: "test,app",
    promotionalText: "Try it now",
    supportUrl: "https://support.example.com",
    marketingUrl: "https://example.com",
  },
};

const NORMALIZED_LOC = {
  id: "loc-1",
  locale: "en-US",
  description: "Test description",
  whatsNew: "Bug fixes",
  keywords: "test,app",
  promotionalText: "Try it now",
  supportUrl: "https://support.example.com",
  marketingUrl: "https://example.com",
};

describe("Version Localizations Routes", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    apiCache._store.clear();
    app = createApp();
  });

  describe("GET /:appId/versions/:versionId/localizations", () => {
    it("returns normalized localizations from ASC API", async () => {
      ascFetch.mockResolvedValue({ data: [MOCK_ASC_LOC] });

      const res = await request(app)
        .get("/api/apps/app-1/versions/ver-1/localizations?accountId=acc-1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([NORMALIZED_LOC]);
      expect(ascFetch).toHaveBeenCalledWith(
        { id: "acc-1", name: "Test Account" },
        expect.stringContaining("/v1/appStoreVersions/ver-1/appStoreVersionLocalizations")
      );
    });

    it("returns cached data when available", async () => {
      apiCache._store.set("apps:version-locs:ver-1:acc-1", [NORMALIZED_LOC]);

      const res = await request(app)
        .get("/api/apps/app-1/versions/ver-1/localizations?accountId=acc-1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([NORMALIZED_LOC]);
      expect(ascFetch).not.toHaveBeenCalled();
    });

    it("returns 502 on ASC API failure", async () => {
      ascFetch.mockRejectedValue(new Error("API down"));

      const res = await request(app)
        .get("/api/apps/app-1/versions/ver-1/localizations?accountId=acc-1");

      expect(res.status).toBe(502);
      expect(res.body.error).toBe("API down");
    });

    it("handles empty data array", async () => {
      ascFetch.mockResolvedValue({ data: [] });

      const res = await request(app)
        .get("/api/apps/app-1/versions/ver-1/localizations?accountId=acc-1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("POST /:appId/versions/:versionId/localizations", () => {
    it("creates a localization and returns normalized result", async () => {
      ascFetch.mockResolvedValue({ data: MOCK_ASC_LOC });

      const res = await request(app)
        .post("/api/apps/app-1/versions/ver-1/localizations")
        .send({ accountId: "acc-1", locale: "en-US", description: "Test description" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(NORMALIZED_LOC);
      expect(ascFetch).toHaveBeenCalledWith(
        { id: "acc-1", name: "Test Account" },
        "/v1/appStoreVersionLocalizations",
        expect.objectContaining({
          method: "POST",
          body: {
            data: {
              type: "appStoreVersionLocalizations",
              attributes: { locale: "en-US", description: "Test description" },
              relationships: {
                appStoreVersion: { data: { type: "appStoreVersions", id: "ver-1" } },
              },
            },
          },
        })
      );
    });

    it("returns 400 when locale is missing", async () => {
      const res = await request(app)
        .post("/api/apps/app-1/versions/ver-1/localizations")
        .send({ accountId: "acc-1" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/locale/i);
    });

    it("returns 400 when accountId is missing", async () => {
      const res = await request(app)
        .post("/api/apps/app-1/versions/ver-1/localizations")
        .send({ locale: "en-US" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for unknown account", async () => {
      const res = await request(app)
        .post("/api/apps/app-1/versions/ver-1/localizations")
        .send({ accountId: "nonexistent", locale: "en-US" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Account not found");
    });

    it("invalidates cache on success", async () => {
      ascFetch.mockResolvedValue({ data: MOCK_ASC_LOC });
      apiCache._store.set("apps:version-locs:ver-1:acc-1", []);

      await request(app)
        .post("/api/apps/app-1/versions/ver-1/localizations")
        .send({ accountId: "acc-1", locale: "en-US" });

      expect(apiCache.deleteByPrefix).toHaveBeenCalledWith("apps:version-locs:ver-1:");
    });

    it("only includes defined optional fields in attributes", async () => {
      ascFetch.mockResolvedValue({ data: MOCK_ASC_LOC });

      await request(app)
        .post("/api/apps/app-1/versions/ver-1/localizations")
        .send({ accountId: "acc-1", locale: "ja", whatsNew: "New stuff" });

      const callArgs = ascFetch.mock.calls[0][2];
      const attributes = callArgs.body.data.attributes;
      expect(attributes).toEqual({ locale: "ja", whatsNew: "New stuff" });
      expect(attributes).not.toHaveProperty("description");
      expect(attributes).not.toHaveProperty("keywords");
    });
  });

  describe("PATCH /:appId/versions/:versionId/localizations/:locId", () => {
    it("updates a localization with sparse fields", async () => {
      ascFetch.mockResolvedValue({ data: MOCK_ASC_LOC });

      const res = await request(app)
        .patch("/api/apps/app-1/versions/ver-1/localizations/loc-1")
        .send({ accountId: "acc-1", description: "Updated desc" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(NORMALIZED_LOC);
      expect(ascFetch).toHaveBeenCalledWith(
        { id: "acc-1", name: "Test Account" },
        "/v1/appStoreVersionLocalizations/loc-1",
        expect.objectContaining({
          method: "PATCH",
          body: {
            data: {
              type: "appStoreVersionLocalizations",
              id: "loc-1",
              attributes: { description: "Updated desc" },
            },
          },
        })
      );
    });

    it("returns 400 when accountId is missing", async () => {
      const res = await request(app)
        .patch("/api/apps/app-1/versions/ver-1/localizations/loc-1")
        .send({ description: "test" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("accountId is required");
    });

    it("invalidates cache on success", async () => {
      ascFetch.mockResolvedValue({ data: MOCK_ASC_LOC });

      await request(app)
        .patch("/api/apps/app-1/versions/ver-1/localizations/loc-1")
        .send({ accountId: "acc-1", whatsNew: "Fixed bugs" });

      expect(apiCache.deleteByPrefix).toHaveBeenCalledWith("apps:version-locs:ver-1:");
    });

    it("handles all 6 fields in a single update", async () => {
      ascFetch.mockResolvedValue({ data: MOCK_ASC_LOC });

      await request(app)
        .patch("/api/apps/app-1/versions/ver-1/localizations/loc-1")
        .send({
          accountId: "acc-1",
          description: "d",
          whatsNew: "w",
          keywords: "k",
          promotionalText: "p",
          supportUrl: "s",
          marketingUrl: "m",
        });

      const attributes = ascFetch.mock.calls[0][2].body.data.attributes;
      expect(attributes).toEqual({
        description: "d",
        whatsNew: "w",
        keywords: "k",
        promotionalText: "p",
        supportUrl: "s",
        marketingUrl: "m",
      });
    });
  });

  describe("DELETE /:appId/versions/:versionId/localizations/:locId", () => {
    it("deletes a localization", async () => {
      ascFetch.mockResolvedValue({});

      const res = await request(app)
        .delete("/api/apps/app-1/versions/ver-1/localizations/loc-1?accountId=acc-1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(ascFetch).toHaveBeenCalledWith(
        { id: "acc-1", name: "Test Account" },
        "/v1/appStoreVersionLocalizations/loc-1",
        { method: "DELETE" }
      );
    });

    it("invalidates cache on success", async () => {
      ascFetch.mockResolvedValue({});

      await request(app)
        .delete("/api/apps/app-1/versions/ver-1/localizations/loc-1?accountId=acc-1");

      expect(apiCache.deleteByPrefix).toHaveBeenCalledWith("apps:version-locs:ver-1:");
    });

    it("returns 502 on ASC API failure", async () => {
      ascFetch.mockRejectedValue(new Error("Delete failed"));

      const res = await request(app)
        .delete("/api/apps/app-1/versions/ver-1/localizations/loc-1?accountId=acc-1");

      expect(res.status).toBe(502);
      expect(res.body.error).toBe("Delete failed");
    });
  });
});
