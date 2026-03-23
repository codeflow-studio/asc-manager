import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchCiWorkflowDetail,
  updateCiWorkflow,
  fetchCiXcodeVersions,
} from "../api/index.js";
import {
  CI_ACTION_TYPES,
  CI_PLATFORMS,
  CI_SCHEDULE_FREQUENCIES,
  CI_DAYS_OF_WEEK,
} from "../constants/index.js";
import AppIcon from "./AppIcon.jsx";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Reusable form controls ──────────────────────────────────────────────────

function FormField({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] uppercase tracking-wide text-dark-ghost font-semibold mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, ...props }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-dark-hover border border-dark-border rounded-lg px-3 py-2 text-[13px] text-dark-text placeholder:text-dark-ghost font-sans focus:outline-none focus:border-accent"
      {...props}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-dark-hover border border-dark-border rounded-lg px-3 py-2 text-[13px] text-dark-text placeholder:text-dark-ghost font-sans focus:outline-none focus:border-accent resize-y"
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-[36px] h-[20px] rounded-full border-none cursor-pointer transition-colors shrink-0"
        style={{ background: checked ? "#34c759" : "#48484a" }}
      >
        <span
          className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-[left]"
          style={{ left: checked ? "18px" : "2px" }}
        />
      </button>
      {label && <span className="text-[13px] text-dark-label">{label}</span>}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-dark-hover border border-dark-border rounded-lg px-3 py-2 text-[13px] text-dark-text font-sans focus:outline-none focus:border-accent appearance-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value || opt.id} value={opt.value || opt.id}>
          {opt.label || opt.name}
        </option>
      ))}
    </select>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-dark-border accent-accent"
      />
      <span className="text-[13px] text-dark-label">{label}</span>
    </label>
  );
}

// ── Pattern List Editor ─────────────────────────────────────────────────────

function PatternList({ patterns, onChange, label }) {
  const addPattern = () => {
    onChange([...patterns, { pattern: "", isPrefix: false }]);
  };
  const removePattern = (index) => {
    onChange(patterns.filter((_, i) => i !== index));
  };
  const updatePattern = (index, field, value) => {
    const updated = patterns.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    onChange(updated);
  };

  return (
    <div>
      {label && (
        <div className="text-[11px] uppercase tracking-wide text-dark-ghost font-semibold mb-1.5">
          {label}
        </div>
      )}
      <div className="space-y-1.5">
        {patterns.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={p.pattern}
              onChange={(e) => updatePattern(i, "pattern", e.target.value)}
              placeholder="Pattern..."
              className="flex-1 bg-dark-hover border border-dark-border rounded-lg px-3 py-1.5 text-[12px] text-dark-text font-mono placeholder:text-dark-ghost font-sans focus:outline-none focus:border-accent"
            />
            <label className="flex items-center gap-1 text-[11px] text-dark-dim shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={p.isPrefix}
                onChange={(e) => updatePattern(i, "isPrefix", e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-accent"
              />
              Prefix
            </label>
            <button
              onClick={() => removePattern(i)}
              className="text-dark-ghost hover:text-danger text-[14px] bg-transparent border-none cursor-pointer font-sans px-1"
            >
              {"\u00d7"}
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addPattern}
        className="mt-1.5 text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0"
      >
        + Add pattern
      </button>
    </div>
  );
}

// ── Files & Folders Rule ────────────────────────────────────────────────────

function FilesAndFoldersEditor({ rule, onChange }) {
  if (!rule) return null;

  const updateMode = (mode) => onChange({ ...rule, mode });
  const updateMatchers = (matchers) => onChange({ ...rule, matchers });

  const addMatcher = () => {
    updateMatchers([
      ...(rule.matchers || []),
      { directory: "", fileExtension: "", fileName: "" },
    ]);
  };
  const removeMatcher = (index) => {
    updateMatchers((rule.matchers || []).filter((_, i) => i !== index));
  };
  const updateMatcher = (index, field, value) => {
    updateMatchers(
      (rule.matchers || []).map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      )
    );
  };

  return (
    <div className="mt-4 pt-4 border-t border-dark-border">
      <div className="text-[11px] uppercase tracking-wide text-dark-ghost font-semibold mb-2">
        Files & Folders Rule
      </div>
      <div className="flex items-center gap-3 mb-3">
        <Select
          value={rule.mode}
          onChange={updateMode}
          options={[
            { value: "START_IF_ANY_FILE_MATCHES", label: "Start if any match" },
            { value: "DO_NOT_START_IF_ALL_FILES_MATCH", label: "Skip if all match" },
          ]}
        />
      </div>
      <div className="space-y-2">
        {(rule.matchers || []).map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={m.directory || ""}
              onChange={(e) => updateMatcher(i, "directory", e.target.value)}
              placeholder="Directory"
              className="flex-1 bg-dark-hover border border-dark-border rounded-lg px-2.5 py-1.5 text-[12px] text-dark-text font-mono placeholder:text-dark-ghost focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={m.fileExtension || ""}
              onChange={(e) => updateMatcher(i, "fileExtension", e.target.value)}
              placeholder=".ext"
              className="w-16 bg-dark-hover border border-dark-border rounded-lg px-2.5 py-1.5 text-[12px] text-dark-text font-mono placeholder:text-dark-ghost focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={m.fileName || ""}
              onChange={(e) => updateMatcher(i, "fileName", e.target.value)}
              placeholder="File name"
              className="flex-1 bg-dark-hover border border-dark-border rounded-lg px-2.5 py-1.5 text-[12px] text-dark-text font-mono placeholder:text-dark-ghost focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => removeMatcher(i)}
              className="text-dark-ghost hover:text-danger text-[14px] bg-transparent border-none cursor-pointer font-sans px-1"
            >
              {"\u00d7"}
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addMatcher}
        className="mt-1.5 text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer font-sans px-0"
      >
        + Add matcher
      </button>
    </div>
  );
}

// ── Section: General ────────────────────────────────────────────────────────

function GeneralSection({ form, setField }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-dark-text m-0 mb-5">General</h2>
      <div className="bg-dark-surface rounded-xl p-5 space-y-4">
        <FormField label="Name">
          <TextInput
            value={form.name}
            onChange={(v) => setField("name", v)}
            placeholder="Workflow name"
          />
        </FormField>
        <FormField label="Description">
          <TextArea
            value={form.description}
            onChange={(v) => setField("description", v)}
            placeholder="Optional description"
            rows={2}
          />
        </FormField>
        <div className="flex items-center gap-6">
          <Toggle
            checked={form.isEnabled}
            onChange={(v) => setField("isEnabled", v)}
            label="Enabled"
          />
          <Checkbox
            checked={form.isLockedForEditing}
            onChange={(v) => setField("isLockedForEditing", v)}
            label="Locked for editing"
          />
        </div>
      </div>
    </div>
  );
}

// ── Section: Environment ────────────────────────────────────────────────────

function EnvironmentSection({ form, setField, xcodeVersions }) {
  const selectedXcode = xcodeVersions.find((v) => v.id === form.xcodeVersionId);
  const macOsOptions = selectedXcode?.macOsVersions || [];

  return (
    <div>
      <h2 className="text-lg font-bold text-dark-text m-0 mb-5">Environment</h2>
      <div className="bg-dark-surface rounded-xl p-5 space-y-4">
        <FormField label="Xcode Version">
          <Select
            value={form.xcodeVersionId}
            onChange={(v) => {
              setField("xcodeVersionId", v);
              // Auto-select first compatible macOS version
              const xcode = xcodeVersions.find((xv) => xv.id === v);
              if (xcode?.macOsVersions?.length > 0) {
                setField("macOsVersionId", xcode.macOsVersions[0].id);
              }
            }}
            options={xcodeVersions.map((v) => ({
              value: v.id,
              label: `Xcode ${v.name}`,
            }))}
            placeholder="Select Xcode version"
          />
        </FormField>
        <FormField label="macOS Version">
          <Select
            value={form.macOsVersionId}
            onChange={(v) => setField("macOsVersionId", v)}
            options={macOsOptions.map((v) => ({
              value: v.id,
              label: `macOS ${v.name}`,
            }))}
            placeholder={macOsOptions.length === 0 ? "Select Xcode first" : "Select macOS version"}
          />
        </FormField>
        <Checkbox
          checked={form.clean}
          onChange={(v) => setField("clean", v)}
          label="Clean build"
        />
        <FormField label="Container File Path">
          <TextInput
            value={form.containerFilePath}
            onChange={(v) => setField("containerFilePath", v)}
            placeholder="e.g., MyApp.xcworkspace"
          />
        </FormField>
      </div>
    </div>
  );
}

// ── Section: Start Conditions ───────────────────────────────────────────────

function getActiveConditionType(form) {
  if (form.branchStartCondition) return "branch";
  if (form.tagStartCondition) return "tag";
  if (form.pullRequestStartCondition) return "pullRequest";
  if (form.scheduledStartCondition) return "scheduled";
  return "none";
}

function PatternConditionEditor({ condition, onChange, patternKey, label }) {
  const patterns = condition?.source?.[patternKey] || [];
  const autoCancel = condition?.autoCancel ?? false;
  const filesAndFoldersRule = condition?.filesAndFoldersRule || null;

  const updatePatterns = (newPatterns) => {
    onChange({
      ...condition,
      source: { ...condition?.source, [patternKey]: newPatterns },
    });
  };

  return (
    <div className="space-y-3">
      <PatternList
        patterns={patterns}
        onChange={updatePatterns}
        label={label}
      />
      <Checkbox
        checked={autoCancel}
        onChange={(v) => onChange({ ...condition, autoCancel: v })}
        label="Auto-cancel superseded builds"
      />
      <FilesAndFoldersEditor
        rule={filesAndFoldersRule}
        onChange={(r) => onChange({ ...condition, filesAndFoldersRule: r })}
      />
    </div>
  );
}

function PullRequestConditionEditor({ condition, onChange }) {
  const sourcePatterns = condition?.source?.branchPatterns || [];
  const destPatterns = condition?.destination?.branchPatterns || [];
  const autoCancel = condition?.autoCancel ?? false;
  const filesAndFoldersRule = condition?.filesAndFoldersRule || null;

  return (
    <div className="space-y-3">
      <PatternList
        patterns={sourcePatterns}
        onChange={(p) =>
          onChange({
            ...condition,
            source: { ...condition?.source, branchPatterns: p },
          })
        }
        label="Source Branch Patterns"
      />
      <PatternList
        patterns={destPatterns}
        onChange={(p) =>
          onChange({
            ...condition,
            destination: { ...condition?.destination, branchPatterns: p },
          })
        }
        label="Destination Branch Patterns"
      />
      <Checkbox
        checked={autoCancel}
        onChange={(v) => onChange({ ...condition, autoCancel: v })}
        label="Auto-cancel superseded builds"
      />
      <FilesAndFoldersEditor
        rule={filesAndFoldersRule}
        onChange={(r) => onChange({ ...condition, filesAndFoldersRule: r })}
      />
    </div>
  );
}

function ScheduledConditionEditor({ condition, onChange }) {
  const frequency = condition?.frequency || "WEEKLY";
  const days = condition?.days || [];
  const hour = condition?.hour ?? 0;
  const minute = condition?.minute ?? 0;
  const timezone = condition?.timezone || "UTC";

  const update = (field, value) => onChange({ ...condition, [field]: value });

  const toggleDay = (day) => {
    const newDays = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    update("days", newDays);
  };

  return (
    <div className="space-y-4">
      <FormField label="Frequency">
        <Select
          value={frequency}
          onChange={(v) => update("frequency", v)}
          options={CI_SCHEDULE_FREQUENCIES}
        />
      </FormField>

      {frequency === "WEEKLY" && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-dark-ghost font-semibold mb-1.5">
            Days
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CI_DAYS_OF_WEEK.map((d) => (
              <button
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer font-sans transition-colors ${
                  days.includes(d.value)
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-dark-border bg-transparent text-dark-label"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <FormField label="Hour">
          <input
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => update("hour", Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
            className="w-20 bg-dark-hover border border-dark-border rounded-lg px-3 py-2 text-[13px] text-dark-text font-sans focus:outline-none focus:border-accent"
          />
        </FormField>
        <FormField label="Minute">
          <input
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={(e) => update("minute", Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
            className="w-20 bg-dark-hover border border-dark-border rounded-lg px-3 py-2 text-[13px] text-dark-text font-sans focus:outline-none focus:border-accent"
          />
        </FormField>
        <FormField label="Timezone">
          <TextInput
            value={timezone}
            onChange={(v) => update("timezone", v)}
          />
        </FormField>
      </div>

      <FormField label="Source Branch">
        <TextInput
          value={condition?.source?.branchPatterns?.[0]?.pattern || ""}
          onChange={(v) =>
            onChange({
              ...condition,
              source: { branchPatterns: [{ pattern: v, isPrefix: false }] },
            })
          }
          placeholder="main"
        />
      </FormField>
    </div>
  );
}

function StartConditionsSection({ form, setField }) {
  const activeType = getActiveConditionType(form);

  const conditionTypes = [
    { value: "branch", label: "Branch Changes" },
    { value: "tag", label: "Tag Changes" },
    { value: "pullRequest", label: "Pull Request" },
    { value: "scheduled", label: "Scheduled" },
  ];

  const switchConditionType = (type) => {
    const defaults = {
      branch: { source: { branchPatterns: [] }, autoCancel: false },
      tag: { source: { tagPatterns: [] }, autoCancel: false },
      pullRequest: {
        source: { branchPatterns: [] },
        destination: { branchPatterns: [] },
        autoCancel: false,
      },
      scheduled: {
        frequency: "WEEKLY",
        days: ["MONDAY"],
        hour: 2,
        minute: 0,
        timezone: "UTC",
        source: { branchPatterns: [{ pattern: "main", isPrefix: false }] },
      },
    };

    const conditionKey = {
      branch: "branchStartCondition",
      tag: "tagStartCondition",
      pullRequest: "pullRequestStartCondition",
      scheduled: "scheduledStartCondition",
    }[type];

    setForm((prev) => ({
      ...prev,
      branchStartCondition: null,
      tagStartCondition: null,
      pullRequestStartCondition: null,
      scheduledStartCondition: null,
      ...(conditionKey && defaults[type] ? { [conditionKey]: defaults[type] } : {}),
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-dark-text m-0 mb-5">
        Start Conditions
      </h2>
      <div className="bg-dark-surface rounded-xl p-5">
        {/* Condition type selector */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {conditionTypes.map((ct) => (
            <button
              key={ct.value}
              onClick={() => switchConditionType(ct.value)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer font-sans transition-colors ${
                activeType === ct.value
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-dark-border bg-transparent text-dark-label hover:bg-dark-hover"
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>

        {/* Condition editors */}
        {activeType === "branch" && (
          <PatternConditionEditor
            condition={form.branchStartCondition}
            onChange={(c) => setField("branchStartCondition", c)}
            patternKey="branchPatterns"
            label="Branch Patterns"
          />
        )}
        {activeType === "tag" && (
          <PatternConditionEditor
            condition={form.tagStartCondition}
            onChange={(c) => setField("tagStartCondition", c)}
            patternKey="tagPatterns"
            label="Tag Patterns"
          />
        )}
        {activeType === "pullRequest" && (
          <PullRequestConditionEditor
            condition={form.pullRequestStartCondition}
            onChange={(c) => setField("pullRequestStartCondition", c)}
          />
        )}
        {activeType === "scheduled" && (
          <ScheduledConditionEditor
            condition={form.scheduledStartCondition}
            onChange={(c) => setField("scheduledStartCondition", c)}
          />
        )}

        {activeType === "none" && (
          <div className="text-[12px] text-dark-ghost text-center py-4">
            No start condition configured. Select a type above.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section: Actions ────────────────────────────────────────────────────────

function ActionEditor({ action, index, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...action, [field]: value });

  return (
    <div className="bg-dark-hover rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-dark-text uppercase tracking-wide">
          Action {index + 1}
        </span>
        <button
          onClick={onRemove}
          className="text-[11px] text-dark-ghost hover:text-danger bg-transparent border-none cursor-pointer font-sans"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Name">
          <TextInput
            value={action.name || ""}
            onChange={(v) => update("name", v)}
            placeholder="Action name"
          />
        </FormField>
        <FormField label="Action Type">
          <Select
            value={action.actionType || "BUILD"}
            onChange={(v) => update("actionType", v)}
            options={CI_ACTION_TYPES}
          />
        </FormField>
        <FormField label="Platform">
          <Select
            value={action.platform || "IOS"}
            onChange={(v) => update("platform", v)}
            options={CI_PLATFORMS}
          />
        </FormField>
        <FormField label="Scheme">
          <TextInput
            value={action.scheme || ""}
            onChange={(v) => update("scheme", v)}
            placeholder="Scheme name"
          />
        </FormField>
      </div>

      {action.actionType === "ARCHIVE" && (
        <FormField label="Distribution">
          <Select
            value={action.buildDistributionAudience || ""}
            onChange={(v) => update("buildDistributionAudience", v || null)}
            options={[
              { value: "INTERNAL_ONLY", label: "Internal Only" },
              { value: "APP_STORE_ELIGIBLE", label: "App Store Eligible" },
            ]}
            placeholder="None"
          />
        </FormField>
      )}

      <Checkbox
        checked={action.isRequiredToPass ?? true}
        onChange={(v) => update("isRequiredToPass", v)}
        label="Required to pass"
      />
    </div>
  );
}

function ActionsSection({ form, setField }) {
  const actions = form.actions || [];

  const addAction = () => {
    setField("actions", [
      ...actions,
      {
        name: "",
        actionType: "BUILD",
        platform: "IOS",
        scheme: "",
        isRequiredToPass: true,
      },
    ]);
  };

  const updateAction = (index, updatedAction) => {
    setField(
      "actions",
      actions.map((a, i) => (i === index ? updatedAction : a))
    );
  };

  const removeAction = (index) => {
    setField(
      "actions",
      actions.filter((_, i) => i !== index)
    );
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-dark-text m-0 mb-5">Actions</h2>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <ActionEditor
            key={i}
            action={action}
            index={i}
            onChange={(a) => updateAction(i, a)}
            onRemove={() => removeAction(i)}
          />
        ))}
        <button
          onClick={addAction}
          className="w-full py-2.5 rounded-lg text-[12px] font-semibold text-accent border border-dashed border-accent/40 bg-transparent cursor-pointer font-sans hover:bg-accent/5 transition-colors"
        >
          + Add Action
        </button>
      </div>
    </div>
  );
}

// ── Section: Environment Variables ──────────────────────────────────────────

function EnvironmentVariablesSection({ app }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-dark-text m-0 mb-5">
        Environment Variables
      </h2>
      <div className="bg-dark-surface rounded-xl p-5">
        <div className="text-[13px] text-dark-label mb-3">
          Environment variables are managed directly in App Store Connect.
          The App Store Connect API does not currently support reading or modifying environment variables.
        </div>
        <a
          href={`https://appstoreconnect.apple.com/apps/${app.id}/ci/workflows`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-accent text-white border-none cursor-pointer font-sans no-underline hover:bg-accent/90 transition-colors"
        >
          Manage in App Store Connect
          <span className="text-[10px]">{"\u2197"}</span>
        </a>
      </div>
    </div>
  );
}

// ── Sidebar Nav ─────────────────────────────────────────────────────────────

function NavItem({ label, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] font-medium border-none cursor-pointer font-sans transition-colors block ${
        active
          ? "bg-accent/15 text-accent"
          : "bg-transparent text-dark-label hover:bg-dark-hover"
      }`}
    >
      {icon && <span className="mr-2 text-dark-ghost">{icon}</span>}
      {label}
    </button>
  );
}

function StickyHeader({ isMobile, children }) {
  return (
    <div className={`sticky top-0 z-10 bg-dark-bg/80 backdrop-blur-lg border-b border-dark-border ${isMobile ? "px-3 py-3" : "px-7 py-3"}`}>
      {children}
    </div>
  );
}

function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="flex items-center gap-1.5 text-accent text-sm font-medium bg-transparent border-none cursor-pointer font-sans px-0"
    >
      <span className="text-lg leading-none">{"\u2039"}</span>
      Xcode Cloud
    </button>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "general", label: "General", icon: "\u2699" },
  { key: "environment", label: "Environment", icon: "\u2601" },
  { key: "start-conditions", label: "Start Conditions", icon: "\u25b6" },
  { key: "actions", label: "Actions", icon: "\u2692" },
  { key: "env-vars", label: "Environment Variables", icon: "$" },
];

export default function WorkflowEditPage({ app, workflowId, isMobile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [originalFormJson, setOriginalFormJson] = useState(null);
  const [form, setForm] = useState(null);

  const [xcodeVersions, setXcodeVersions] = useState([]);
  const [activeSection, setActiveSection] = useState("general");

  const initFormFromWorkflow = useCallback((wf) => {
    return {
      name: wf.name || "",
      description: wf.description || "",
      isEnabled: wf.isEnabled ?? true,
      isLockedForEditing: wf.isLockedForEditing ?? false,
      clean: wf.clean ?? false,
      containerFilePath: wf.containerFilePath || "",
      xcodeVersionId: wf.xcodeVersion?.id || "",
      macOsVersionId: wf.macOsVersion?.id || "",
      actions: deepClone(wf.actions || []),
      branchStartCondition: wf.branchStartCondition ? deepClone(wf.branchStartCondition) : null,
      tagStartCondition: wf.tagStartCondition ? deepClone(wf.tagStartCondition) : null,
      pullRequestStartCondition: wf.pullRequestStartCondition ? deepClone(wf.pullRequestStartCondition) : null,
      scheduledStartCondition: wf.scheduledStartCondition ? deepClone(wf.scheduledStartCondition) : null,
      manualBranchStartCondition: wf.manualBranchStartCondition ? deepClone(wf.manualBranchStartCondition) : null,
      manualTagStartCondition: wf.manualTagStartCondition ? deepClone(wf.manualTagStartCondition) : null,
      manualPullRequestStartCondition: wf.manualPullRequestStartCondition ? deepClone(wf.manualPullRequestStartCondition) : null,
    };
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [wf, versions] = await Promise.all([
        fetchCiWorkflowDetail(app.id, workflowId, app.accountId),
        fetchCiXcodeVersions(app.id, app.accountId),
      ]);
      setXcodeVersions(versions);
      const formData = initFormFromWorkflow(wf);
      setOriginalFormJson(JSON.stringify(formData));
      setForm(formData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [app.id, app.accountId, workflowId, initFormFromWorkflow]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setField = useCallback((field, value) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const isDirty = useMemo(() => {
    if (!form || !originalFormJson) return false;
    return JSON.stringify(form) !== originalFormJson;
  }, [form, originalFormJson]);

  const handleSave = useCallback(async () => {
    if (!form || !isDirty) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = {
        accountId: app.accountId,
        name: form.name,
        description: form.description,
        isEnabled: form.isEnabled,
        isLockedForEditing: form.isLockedForEditing,
        clean: form.clean,
        containerFilePath: form.containerFilePath,
        actions: form.actions,
        branchStartCondition: form.branchStartCondition,
        tagStartCondition: form.tagStartCondition,
        pullRequestStartCondition: form.pullRequestStartCondition,
        scheduledStartCondition: form.scheduledStartCondition,
        manualBranchStartCondition: form.manualBranchStartCondition,
        manualTagStartCondition: form.manualTagStartCondition,
        manualPullRequestStartCondition: form.manualPullRequestStartCondition,
      };
      payload.xcodeVersionId = form.xcodeVersionId || null;
      payload.macOsVersionId = form.macOsVersionId || null;

      const updated = await updateCiWorkflow(app.id, workflowId, payload);
      const updatedForm = initFormFromWorkflow(updated);
      setOriginalFormJson(JSON.stringify(updatedForm));
      setForm(updatedForm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, isDirty, app.id, app.accountId, workflowId, initFormFromWorkflow]);

  if (loading) {
    return (
      <div style={{ animation: "asc-slidein 0.3s ease backwards" }}>
        <StickyHeader isMobile={isMobile}>
          <div className="flex items-center gap-3"><BackButton /></div>
        </StickyHeader>
        <div className="text-center px-5 py-20 text-dark-dim">
          <div className="text-[28px] mb-3 inline-block" style={{ animation: "asc-spin 1s linear infinite" }}>{"\u21bb"}</div>
          <div className="text-sm font-semibold">Loading workflow...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ animation: "asc-slidein 0.3s ease backwards" }}>
        <StickyHeader isMobile={isMobile}>
          <div className="flex items-center gap-3"><BackButton /></div>
        </StickyHeader>
        <div className="text-center px-5 py-16 text-danger">
          <div className="text-sm font-semibold mb-2">Failed to load workflow</div>
          <div className="text-xs text-dark-dim max-w-[400px] mx-auto mb-4">{error}</div>
          <button onClick={loadData} className="px-[18px] py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer font-sans">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "asc-slidein 0.3s ease backwards" }}>
      {/* Breadcrumb + Save */}
      <StickyHeader isMobile={isMobile}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="text-dark-phantom text-sm">/</span>
            <span className="text-sm text-dark-dim font-medium truncate max-w-[200px]">
              {form?.name || "Workflow"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-[12px] font-semibold text-success">Saved</span>
            )}
            {saveError && (
              <span className="text-[12px] font-semibold text-danger truncate max-w-[200px]">
                {saveError}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold border-none cursor-pointer font-sans transition-colors ${
                isDirty && !saving
                  ? "bg-accent text-white hover:bg-accent/90"
                  : "bg-dark-hover text-dark-ghost cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </StickyHeader>

      <div className={isMobile ? "px-3 pt-4 pb-10" : "flex gap-0 min-h-[calc(100vh-49px)]"}>
        {/* Sidebar */}
        {!isMobile && (
          <div className="w-[220px] shrink-0 border-r border-dark-border px-3 pt-5 pb-8 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4 px-1">
              <AppIcon app={app} size={18} />
              <span className="text-[14px] font-bold text-dark-text truncate">
                {form?.name || "Workflow"}
              </span>
            </div>

            <div className="space-y-0.5">
              {SECTIONS.map((s) => (
                <NavItem
                  key={s.key}
                  label={s.label}
                  icon={s.icon}
                  active={activeSection === s.key}
                  onClick={() => setActiveSection(s.key)}
                />
              ))}
            </div>

            {/* Status indicator */}
            <div className="mt-6 px-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ background: form?.isEnabled ? "#34c759" : "#8e8e93" }}
                />
                <span className="text-[11px] text-dark-dim">
                  {form?.isEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className={isMobile ? "" : "flex-1 px-8 pt-6 pb-16 overflow-y-auto max-w-[960px]"}>
          {/* Mobile section selector */}
          {isMobile && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer font-sans ${
                    activeSection === s.key
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-dark-border bg-transparent text-dark-label"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {form && activeSection === "general" && (
            <GeneralSection form={form} setField={setField} />
          )}
          {form && activeSection === "environment" && (
            <EnvironmentSection
              form={form}
              setField={setField}
              xcodeVersions={xcodeVersions}
            />
          )}
          {form && activeSection === "start-conditions" && (
            <StartConditionsSection form={form} setField={setField} />
          )}
          {form && activeSection === "actions" && (
            <ActionsSection form={form} setField={setField} />
          )}
          {form && activeSection === "env-vars" && (
            <EnvironmentVariablesSection app={app} />
          )}
        </div>
      </div>
    </div>
  );
}
