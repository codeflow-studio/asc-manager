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

  it("fetches localizations on mount without user interaction", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    expect(fetchVersionLocalizations).toHaveBeenCalledWith("app-1", "ver-1", "acc-1");

    await waitFor(() => {
      expect(screen.getByText("Localizable Information")).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", async () => {
    let resolvePromise;
    fetchVersionLocalizations.mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    expect(screen.getByText("Loading localizations...")).toBeInTheDocument();

    resolvePromise(MOCK_LOCS);
    await waitFor(() => {
      expect(screen.queryByText("Loading localizations...")).not.toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    fetchVersionLocalizations.mockRejectedValue(new Error("Network error"));

    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load localizations")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows empty state when no localizations exist", async () => {
    fetchVersionLocalizations.mockResolvedValue([]);

    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("No localizations yet")).toBeInTheDocument();
    });
  });

  it("renders locale dropdown with loaded locales", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      const dropdown = screen.getByLabelText("Select locale");
      expect(dropdown).toBeInTheDocument();

      const options = within(dropdown).getAllByRole("option");
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent("English (U.S.) (en-US)");
      expect(options[1]).toHaveTextContent("Japanese (ja)");
      expect(options[2]).toHaveTextContent("Add Locale...");
    });
  });

  it("auto-selects en-US locale and populates form", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Try now")).toBeInTheDocument();
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bug fixes")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test,app")).toBeInTheDocument();
      expect(screen.getByDisplayValue("https://support.example.com")).toBeInTheDocument();
      expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    });
  });

  describe("Prev/Next locale buttons", () => {
    it("disables Previous button on first locale and enables Next", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Previous locale")).toBeDisabled();
        expect(screen.getByLabelText("Next locale")).not.toBeDisabled();
      });
    });

    it("navigates to next locale when Next is clicked", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText("Next locale"));

      expect(screen.getByDisplayValue("Japanese description")).toBeInTheDocument();
      expect(screen.getByLabelText("Previous locale")).not.toBeDisabled();
      expect(screen.getByLabelText("Next locale")).toBeDisabled();
    });

    it("navigates back to previous locale when Previous is clicked", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText("Next locale"));
      expect(screen.getByDisplayValue("Japanese description")).toBeInTheDocument();

      await user.click(screen.getByLabelText("Previous locale"));
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
    });
  });

  it("preserves edits when switching locales and back", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
    });

    // Edit en-US description
    const descField = screen.getByDisplayValue("English description");
    await user.clear(descField);
    await user.type(descField, "Modified English");

    // Switch to ja
    const dropdown = screen.getByLabelText("Select locale");
    await user.selectOptions(dropdown, "loc-2");
    expect(screen.getByDisplayValue("Japanese description")).toBeInTheDocument();

    // Switch back to en-US -- edits should be preserved
    await user.selectOptions(dropdown, "loc-1");
    expect(screen.getByDisplayValue("Modified English")).toBeInTheDocument();

    // Save should be enabled since form is dirty
    expect(screen.getByText("Save")).not.toBeDisabled();
  });

  it("preserves edits on multiple locales independently", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
    });

    // Edit en-US
    const descField = screen.getByDisplayValue("English description");
    await user.clear(descField);
    await user.type(descField, "Modified English");

    // Switch to ja and edit it too
    const dropdown = screen.getByLabelText("Select locale");
    await user.selectOptions(dropdown, "loc-2");
    const jaDescField = screen.getByDisplayValue("Japanese description");
    await user.clear(jaDescField);
    await user.type(jaDescField, "Modified Japanese");

    // Switch back to en-US -- should have its own edits
    await user.selectOptions(dropdown, "loc-1");
    expect(screen.getByDisplayValue("Modified English")).toBeInTheDocument();

    // Switch to ja -- should have its own edits
    await user.selectOptions(dropdown, "loc-2");
    expect(screen.getByDisplayValue("Modified Japanese")).toBeInTheDocument();
  });

  it("discard clears drafts for all locales", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
    });

    // Edit en-US
    const descField = screen.getByDisplayValue("English description");
    await user.clear(descField);
    await user.type(descField, "Temp English");

    // Switch to ja and edit it
    const dropdown = screen.getByLabelText("Select locale");
    await user.selectOptions(dropdown, "loc-2");
    const jaField = screen.getByDisplayValue("Japanese description");
    await user.clear(jaField);
    await user.type(jaField, "Temp Japanese");

    // Discard should clear all
    await user.click(screen.getByText("Discard"));
    expect(screen.getByDisplayValue("Japanese description")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeDisabled();

    // Switch back to en-US -- should also be reset
    await user.selectOptions(dropdown, "loc-1");
    expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
  });

  it("defaults to en-US even when it is not first in the array", async () => {
    fetchVersionLocalizations.mockResolvedValue([MOCK_LOCS[1], MOCK_LOCS[0]]);

    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      const dropdown = screen.getByLabelText("Select locale");
      expect(dropdown.value).toBe("loc-1");
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
    });
  });

  it("switches locale and updates form fields", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
    });

    const dropdown = screen.getByLabelText("Select locale");
    await user.selectOptions(dropdown, "loc-2");

    expect(screen.getByDisplayValue("Japanese description")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("English description")).not.toBeInTheDocument();
  });

  it("displays character counters with remaining characters", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Try now")).toBeInTheDocument();
    });

    // "Try now" = 7 chars, 170 - 7 = 163
    expect(screen.getByText("163 remaining")).toBeInTheDocument();
    // "test,app" = 8 chars, 100 - 8 = 92
    expect(screen.getByText("92 remaining")).toBeInTheDocument();
  });

  it("updates character counter in real-time when typing", async () => {
    render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("test,app")).toBeInTheDocument();
    });

    const keywordsField = screen.getByDisplayValue("test,app");
    await user.type(keywordsField, ",new");

    expect(screen.getByText("88 remaining")).toBeInTheDocument();
  });

  describe("Save and Discard", () => {
    it("disables Save button when form is clean", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Save")).toBeInTheDocument();
      });

      expect(screen.getByText("Save")).toBeDisabled();
    });

    it("enables Save button when form is dirty", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      const descField = screen.getByDisplayValue("English description");
      await user.type(descField, " updated");

      expect(screen.getByText("Save")).not.toBeDisabled();
    });

    it("saves changes and resets dirty state", async () => {
      updateVersionLocalization.mockResolvedValue({
        ...MOCK_LOCS[0],
        description: "Updated description",
      });

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

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
        expect(screen.getByText("Save")).toBeDisabled();
      });
    });

    it("saves all dirty locales at once", async () => {
      updateVersionLocalization
        .mockResolvedValueOnce({ ...MOCK_LOCS[0], description: "New English" })
        .mockResolvedValueOnce({ ...MOCK_LOCS[1], description: "New Japanese" });

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      // Edit en-US
      const enField = screen.getByDisplayValue("English description");
      await user.clear(enField);
      await user.type(enField, "New English");

      // Switch to ja and edit
      const dropdown = screen.getByLabelText("Select locale");
      await user.selectOptions(dropdown, "loc-2");
      const jaField = screen.getByDisplayValue("Japanese description");
      await user.clear(jaField);
      await user.type(jaField, "New Japanese");

      // Save should save both
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(updateVersionLocalization).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByText("Save")).toBeDisabled();
      });
    });

    it("keeps Save enabled when a non-selected locale has unsaved changes", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      // Edit en-US
      const descField = screen.getByDisplayValue("English description");
      await user.type(descField, " changed");

      // Switch to ja (clean locale) -- Save should still be enabled
      const dropdown = screen.getByLabelText("Select locale");
      await user.selectOptions(dropdown, "loc-2");

      expect(screen.getByText("Save")).not.toBeDisabled();
    });

    it("shows error when save fails", async () => {
      updateVersionLocalization.mockRejectedValue(new Error("Save failed"));

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      const descField = screen.getByDisplayValue("English description");
      await user.type(descField, " changed");

      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(screen.getByText("Save failed")).toBeInTheDocument();
      });
    });

    it("discards changes and resets form to stored values", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      const descField = screen.getByDisplayValue("English description");
      await user.clear(descField);
      await user.type(descField, "Temporary changes");

      expect(screen.getByDisplayValue("Temporary changes")).toBeInTheDocument();

      await user.click(screen.getByText("Discard"));

      expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Temporary changes")).not.toBeInTheDocument();
      expect(screen.getByText("Save")).toBeDisabled();
    });
  });

  describe("Add Locale", () => {
    it("shows locale code input when Add Locale is selected", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Select locale")).toBeInTheDocument();
      });

      const dropdown = screen.getByLabelText("Select locale");
      await user.selectOptions(dropdown, "__add__");

      expect(screen.getByLabelText("New locale code")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g. de-DE")).toBeInTheDocument();
    });

    it("creates a new locale and selects it", async () => {
      const newLoc = {
        id: "loc-3",
        locale: "de-DE",
        description: "",
        whatsNew: "",
        keywords: "",
        promotionalText: "",
        supportUrl: "",
        marketingUrl: "",
      };
      createVersionLocalization.mockResolvedValue(newLoc);

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Select locale")).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText("Select locale"), "__add__");

      const codeInput = screen.getByLabelText("New locale code");
      await user.type(codeInput, "de-DE");
      await user.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(createVersionLocalization).toHaveBeenCalledWith(
          "app-1", "ver-1",
          expect.objectContaining({
            accountId: "acc-1",
            locale: "de-DE",
          })
        );
      });

      await waitFor(() => {
        const dropdown = screen.getByLabelText("Select locale");
        expect(dropdown.value).toBe("loc-3");
      });
    });

    it("shows error when add locale fails", async () => {
      createVersionLocalization.mockRejectedValue(new Error("Duplicate locale"));

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Select locale")).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText("Select locale"), "__add__");

      await user.type(screen.getByLabelText("New locale code"), "en-US");
      await user.click(screen.getByText("Add"));

      await waitFor(() => {
        expect(screen.getByText("Duplicate locale")).toBeInTheDocument();
      });
    });

    it("cancels add locale flow", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByLabelText("Select locale")).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText("Select locale"), "__add__");
      expect(screen.getByLabelText("New locale code")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));
      expect(screen.queryByLabelText("New locale code")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Select locale")).toBeInTheDocument();
    });
  });

  describe("Delete Locale", () => {
    it("shows Delete Locale button when 2+ locales exist", async () => {
      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Delete Locale")).toBeInTheDocument();
      });
    });

    it("hides Delete Locale button when only 1 locale exists", async () => {
      fetchVersionLocalizations.mockResolvedValue([MOCK_LOCS[0]]);

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("English description")).toBeInTheDocument();
      });

      expect(screen.queryByText("Delete Locale")).not.toBeInTheDocument();
    });

    it("deletes a locale and switches to another", async () => {
      deleteVersionLocalization.mockResolvedValue({ success: true });

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Delete Locale")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Delete Locale"));

      await waitFor(() => {
        expect(deleteVersionLocalization).toHaveBeenCalledWith("app-1", "ver-1", "loc-1", "acc-1");
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Japanese description")).toBeInTheDocument();
        expect(screen.queryByText("Delete Locale")).not.toBeInTheDocument();
      });
    });

    it("shows error when delete fails", async () => {
      deleteVersionLocalization.mockRejectedValue(new Error("Cannot delete primary"));

      render(<VersionLocalizationsSection {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByText("Delete Locale")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Delete Locale"));

      await waitFor(() => {
        expect(screen.getByText("Cannot delete primary")).toBeInTheDocument();
      });
    });
  });
});
