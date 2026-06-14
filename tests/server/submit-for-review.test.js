import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

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

const APP_ID = "app-1";
const VERSION_ID = "ver-1";
const SUBMIT_URL = `/api/apps/${APP_ID}/versions/${VERSION_ID}/submit`;
const SUBMIT_BODY = { accountId: "acc-1", platform: "IOS" };

function mockVersionState(appStoreState) {
  return {
    data: {
      id: VERSION_ID,
      attributes: { appStoreState, platform: "IOS" },
    },
  };
}

function mockUnresolvedSubmission(submissionId = "sub-unresolved") {
  return {
    data: [
      {
        id: submissionId,
        type: "reviewSubmissions",
        attributes: { state: "UNRESOLVED_ISSUES" },
        relationships: {
          items: { data: [{ type: "reviewSubmissionItems", id: "item-1" }] },
        },
      },
    ],
    included: [
      {
        id: "item-1",
        type: "reviewSubmissionItems",
        attributes: { state: "REJECTED" },
        relationships: {
          appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } },
        },
      },
    ],
  };
}

describe("POST /:appId/versions/:versionId/submit", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    apiCache._store.clear();
    app = createApp();
  });

  it("returns 400 when accountId is missing", async () => {
    const res = await request(app)
      .post(SUBMIT_URL)
      .send({ platform: "IOS" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("accountId is required");
  });

  it("returns 400 when platform is missing", async () => {
    const res = await request(app)
      .post(SUBMIT_URL)
      .send({ accountId: "acc-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("platform is required");
  });

  it("returns 409 for unsupported app store state", async () => {
    ascFetch.mockResolvedValueOnce(mockVersionState("WAITING_FOR_REVIEW"));

    const res = await request(app)
      .post(SUBMIT_URL)
      .send(SUBMIT_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Version cannot be submitted from state: WAITING_FOR_REVIEW");
    expect(ascFetch).toHaveBeenCalledTimes(1);
  });

  it("resubmits REJECTED version by patching UNRESOLVED_ISSUES submission", async () => {
    ascFetch
      .mockResolvedValueOnce(mockVersionState("REJECTED"))
      .mockResolvedValueOnce(mockUnresolvedSubmission("sub-99"))
      .mockResolvedValueOnce({ data: { id: "sub-99" } });

    const res = await request(app)
      .post(SUBMIT_URL)
      .send(SUBMIT_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, versionId: VERSION_ID, resubmitted: true });
    expect(ascFetch).toHaveBeenCalledTimes(3);

    const patchCall = ascFetch.mock.calls[2];
    expect(patchCall[1]).toBe("/v1/reviewSubmissions/sub-99");
    expect(patchCall[2].method).toBe("PATCH");
    expect(patchCall[2].body.data.attributes.submitted).toBe(true);
  });

  it("returns 404 when REJECTED version has no unresolved submission", async () => {
    ascFetch
      .mockResolvedValueOnce(mockVersionState("REJECTED"))
      .mockResolvedValueOnce({ data: [], included: [] });

    const res = await request(app)
      .post(SUBMIT_URL)
      .send(SUBMIT_BODY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("No unresolved review submission found for this version");
    expect(ascFetch).toHaveBeenCalledTimes(2);
  });

  it("submits PREPARE_FOR_SUBMISSION version via create-and-submit flow", async () => {
    ascFetch
      .mockResolvedValueOnce(mockVersionState("PREPARE_FOR_SUBMISSION"))
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { id: "sub-new" } })
      .mockResolvedValueOnce({ data: { id: "item-new" } })
      .mockResolvedValueOnce({ data: { id: "sub-new" } });

    const res = await request(app)
      .post(SUBMIT_URL)
      .send(SUBMIT_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, versionId: VERSION_ID });
    expect(ascFetch).toHaveBeenCalledTimes(5);

    expect(ascFetch.mock.calls[1][1]).toContain("filter[state]=READY_FOR_REVIEW");
    expect(ascFetch.mock.calls[2][1]).toBe("/v1/reviewSubmissions");
    expect(ascFetch.mock.calls[2][2].method).toBe("POST");
    expect(ascFetch.mock.calls[3][1]).toBe("/v1/reviewSubmissionItems");
    expect(ascFetch.mock.calls[4][1]).toBe("/v1/reviewSubmissions/sub-new");
  });

  it("submits DEVELOPER_REJECTED version via create-and-submit flow", async () => {
    ascFetch
      .mockResolvedValueOnce(mockVersionState("DEVELOPER_REJECTED"))
      .mockResolvedValueOnce({ data: [{ id: "sub-existing" }] })
      .mockResolvedValueOnce({ data: { id: "item-existing" } })
      .mockResolvedValueOnce({ data: { id: "sub-existing" } });

    const res = await request(app)
      .post(SUBMIT_URL)
      .send(SUBMIT_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, versionId: VERSION_ID });
    expect(ascFetch).toHaveBeenCalledTimes(4);
    expect(ascFetch.mock.calls[3][1]).toBe("/v1/reviewSubmissions/sub-existing");
  });
});
