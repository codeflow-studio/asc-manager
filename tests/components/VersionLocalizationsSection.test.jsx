import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VersionLocalizationsSection from "../../src/components/VersionLocalizationsSection.jsx";

vi.mock("../../src/api/index.js", () => ({
  fetchVersionLocalizations: vi.fn(),
  createVersionLocalization: vi.fn(),
  updateVersionLocalization: vi.fn(),
  deleteVersionLocalization: vi.fn(),
}));

import {
  fetchVersionLocalizations,
  createVersionLocalization,
  updateVersionLocalization,
  deleteVersionLocalization,
} from "../../src/api/index.js";

const MOCK_LOCS = [
  {
    id: "loc-1",
    locale: "en-US",
    description: "English description",
    whatsNew: "Bug fixes",
    keywords: "test,app",
    promotionalText: "Try now",
    supportUrl: "https://support.example.com",
    marketingUrl: "https://example.com",
  },
  {
    id: "loc-2",
    locale: "ja",
    description: "Japanese description",
    whatsNew: "",
    keywords: "",
    promotionalText: "",
    supportUrl: "",
    marketingUrl: "",
  },
];

const DEFAULT_PROPS = {
  appId: "app-1",
  versionId: "ver-1",
  accountId: "acc-1",
  isMobile: false,
};

describe("VersionLocalizationsSection", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    fetchVersionLocalizations.mockResolvedValue(MOCK_LOCS);
  });

  it("renders collapsed by default", () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    expect(screen.getByText("Localizations")).toBeInTheDocument();
    expect(screen.queryByText("en-US")).not.toBeInTheDocument();
    expect(fetchVersionLocalizations).not.toHaveBeenCalled();
  });

  it("fetches and displays localizations when expanded", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await user.click(screen.getByText("Localizations"));

    await waitFor(() => {
      expect(screen.getByText("en-US")).toBeInTheDocument();
      expect(screen.getByText("ja")).toBeInTheDocument();
    });

    expect(fetchVersionLocalizations).toHaveBeenCalledWith("app-1", "ver-1", "acc-1");
  });

  it("shows loading state while fetching", async () => {
    let resolvePromise;
    fetchVersionLocalizations.mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
    await user.click(screen.getByText("Localizations"));

    expect(screen.getByText("Loading localizations...")).toBeInTheDocument();

    resolvePromise(MOCK_LOCS);
    await waitFor(() => {
      expect(screen.queryByText("Loading localizations...")).not.toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    fetchVersionLocalizations.mockRejectedValue(new Error("Network error"));

    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
    await user.click(screen.getByText("Localizations"));

    await waitFor(() => {
      expect(screen.getByText("Failed to load localizations")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows empty state when no localizations exist", async () => {
    fetchVersionLocalizations.mockResolvedValue([]);

    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
    await user.click(screen.getByText("Localizations"));

    await waitFor(() => {
      expect(screen.getByText("No localizations yet")).toBeInTheDocument();
    });
  });

  it("displays count badge after loading", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
    await user.click(screen.getByText("Localizations"));

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("shows truncated description in collapsed locale row", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
    await user.click(screen.getByText("Localizations"));

    await waitFor(() => {
      expect(screen.getByText("English description")).toBeInTheDocument();
    });
  });

  describe("Edit mode", () => {
    async function expandAndWait() {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
      await user.click(screen.getByText("Localizations"));
      await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());
    }

    it("enters edit mode when Edit is clicked", async () => {
      await expandAndWait();

      const editButtons = screen.getAllByText("Edit");
      await user.click(editButtons[0]);

      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bug fixes")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test,app")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Try now")).toBeInTheDocument();
      expect(screen.getByDisplayValue("https://support.example.com")).toBeInTheDocument();
      expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    });

    it("cancels edit mode", async () => {
      await expandAndWait();

      await user.click(screen.getAllByText("Edit")[0]);
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));
      expect(screen.queryByDisplayValue("English description")).not.toBeInTheDocument();
    });

    it("saves changes and updates the list", async () => {
      updateVersionLocalization.mockResolvedValue({
        ...MOCK_LOCS[0],
        description: "Updated description",
      });

      await expandAndWait();
      await user.click(screen.getAllByText("Edit")[0]);

      const descField = screen.getByDisplayValue("English description");
      await user.clear(descField);
      await user.type(descField, "Updated description");

      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(updateVersionLocalization).toHaveBeenCalledWith(
          "app-1", "ver-1", "loc-1",
          expect.objectContaining({
            accountId: "acc-1",
            description: "Updated description",
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText("Updated description")).toBeInTheDocument();
      });
    });

    it("shows error when save fails", async () => {
      updateVersionLocalization.mockRejectedValue(new Error("Save failed"));

      await expandAndWait();
      await user.click(screen.getAllByText("Edit")[0]);
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(screen.getByText("Save failed")).toBeInTheDocument();
      });
    });
  });

  describe("Delete", () => {
    it("deletes a localization and removes it from the list", async () => {
      deleteVersionLocalization.mockResolvedValue({ success: true });

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
      await user.click(screen.getByText("Localizations"));
      await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());

      const deleteButtons = screen.getAllByText("Delete");
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(deleteVersionLocalization).toHaveBeenCalledWith("app-1", "ver-1", "loc-1", "acc-1");
      });

      await waitFor(() => {
        expect(screen.queryByText("English description")).not.toBeInTheDocument();
        expect(screen.getByText("ja")).toBeInTheDocument();
      });
    });

    it("shows error when delete fails", async () => {
      deleteVersionLocalization.mockRejectedValue(new Error("Cannot delete primary"));

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
      await user.click(screen.getByText("Localizations"));
      await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());

      await user.click(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        expect(screen.getByText("Cannot delete primary")).toBeInTheDocument();
      });
    });
  });

  describe("Add localization", () => {
    it("creates a new localization and appends to the list", async () => {
      const newLoc = {
        id: "loc-3",
        locale: "de",
        description: "German desc",
        whatsNew: "",
        keywords: "",
        promotionalText: "",
        supportUrl: "",
        marketingUrl: "",
      };
      createVersionLocalization.mockResolvedValue(newLoc);

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
      await user.click(screen.getByText("Localizations"));
      await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());

      const localeInput = screen.getByPlaceholderText("e.g. en-US, ja, de");
      await user.type(localeInput, "de");

      const descFields = screen.getAllByPlaceholderText("Description");
      const addDescField = descFields[descFields.length - 1];
      await user.type(addDescField, "German desc");

      await user.click(screen.getByText("Add Localization"));

      await waitFor(() => {
        expect(createVersionLocalization).toHaveBeenCalledWith(
          "app-1", "ver-1",
          expect.objectContaining({
            accountId: "acc-1",
            locale: "de",
            description: "German desc",
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText("de")).toBeInTheDocument();
      });
    });

    it("disables Add button when locale is empty", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
      await user.click(screen.getByText("Localizations"));
      await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());

      expect(screen.getByText("Add Localization")).toBeDisabled();
    });

    it("clears form after successful add", async () => {
      createVersionLocalization.mockResolvedValue({
        id: "loc-3", locale: "fr", description: "", whatsNew: "",
        keywords: "", promotionalText: "", supportUrl: "", marketingUrl: "",
      });

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
      await user.click(screen.getByText("Localizations"));
      await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());

      const localeInput = screen.getByPlaceholderText("e.g. en-US, ja, de");
      await user.type(localeInput, "fr");
      await user.click(screen.getByText("Add Localization"));

      await waitFor(() => {
        expect(localeInput).toHaveValue("");
      });
    });

    it("shows error when add fails", async () => {
      createVersionLocalization.mockRejectedValue(new Error("Duplicate locale"));

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
      await user.click(screen.getByText("Localizations"));
      await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());

      const localeInput = screen.getByPlaceholderText("e.g. en-US, ja, de");
      await user.type(localeInput, "en-US");
      await user.click(screen.getByText("Add Localization"));

      await waitFor(() => {
        expect(screen.getByText("Duplicate locale")).toBeInTheDocument();
      });
    });
  });

  it("collapses when clicking the header again", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);
    await user.click(screen.getByText("Localizations"));
    await waitFor(() => expect(screen.getByText("en-US")).toBeInTheDocument());

    await user.click(screen.getByText("Localizations"));
    expect(screen.queryByText("en-US")).not.toBeInTheDocument();
  });
});
