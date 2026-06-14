import { useState, useEffect } from "react";
import { fetchReviewSubmissionDetail } from "../api/index.js";
import { ReviewStatus, formatDate } from "./AppReviewSection.jsx";
import AppIcon from "./AppIcon.jsx";

const ITEM_STATE_DISPLAY = {
  READY_FOR_REVIEW: "Ready for Review",
  ACCEPTED: "Accepted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REMOVED: "Removed",
};

const ITEM_STATE_COLORS = {
  "Ready for Review": "#ff9f0a",
  Accepted: "#30d158",
  Approved: "#30d158",
  Rejected: "#ff453a",
  Removed: "#8e8e93",
};

const ITEM_TYPE_LABELS = {
  appStoreVersion: "App Store Version",
  appCustomProductPage: "Custom Product Page",
  appStoreVersionExperiment: "Product Page Experiment",
  appEvent: "App Event",
};

function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="text-[12px] text-dark-dim w-[140px] shrink-0">{label}</span>
      <span className="text-[13px] text-dark-text">{children}</span>
    </div>
  );
}

export default function ReviewSubmissionDetail({ app, submissionId, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchReviewSubmissionDetail(app.id, submissionId, app.accountId)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [app.id, submissionId, app.accountId]);

  return (
    <div style={{ animation: "asc-slidein 0.3s ease backwards" }}>
      {/* Breadcrumb */}
      <div className={`sticky top-0 z-10 bg-dark-bg/80 backdrop-blur-lg border-b border-dark-border ${isMobile ? "px-3 py-3" : "px-7 py-3"}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-accent text-sm font-medium bg-transparent border-none cursor-pointer font-sans px-0"
          >
            <span className="text-lg leading-none">{"\u2039"}</span>
            {app.name}
          </button>
        </div>
      </div>

      <div className={`${isMobile ? "px-3 py-4" : "px-7 py-5"} max-w-4xl`}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <AppIcon app={app} size={48} />
          <div>
            <h1 className="text-[18px] font-bold text-dark-text m-0 leading-tight">Review Submission</h1>
            <p className="text-[13px] text-dark-dim m-0 mt-0.5">
              {data ? data.versions : "Loading..."}
            </p>
          </div>
          {data && (
            <div className="ml-auto">
              <ReviewStatus status={data.displayStatus} />
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-dark-surface rounded-[10px] px-4 py-8 text-center">
            <span className="text-[12px] text-dark-dim">Loading submission details...</span>
          </div>
        )}

        {error && (
          <div className="bg-dark-surface rounded-[10px] px-4 py-8 text-center">
            <span className="text-[12px] text-dark-dim">Failed to load submission details.</span>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Submission Info */}
            <div className="bg-dark-surface rounded-[10px] p-5">
              <h3 className="text-[12px] font-bold text-dark-text uppercase tracking-wide mb-3">Details</h3>
              <DetailRow label="Status"><ReviewStatus status={data.displayStatus} /></DetailRow>
              <DetailRow label="Date Submitted">{formatDate(data.submittedDate)}</DetailRow>
              <DetailRow label="Platform">{data.platform || "Unknown"}</DetailRow>
              <DetailRow label="Versions">{data.versions}</DetailRow>
              {data.submittedBy && <DetailRow label="Submitted By">{data.submittedBy}</DetailRow>}
              {data.lastUpdatedBy && <DetailRow label="Last Updated By">{data.lastUpdatedBy}</DetailRow>}
            </div>

            {/* Items */}
            {data.items && data.items.length > 0 && (
              <div className="bg-dark-surface rounded-[10px] p-5">
                <h3 className="text-[12px] font-bold text-dark-text uppercase tracking-wide mb-3">
                  Submission Items ({data.items.length})
                </h3>
                <div className="rounded-lg overflow-hidden border border-dark-border">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="text-[10px] font-bold text-dark-dim uppercase tracking-wide px-4 py-2.5">Type</th>
                        <th className="text-[10px] font-bold text-dark-dim uppercase tracking-wide px-4 py-2.5">Version</th>
                        <th className="text-[10px] font-bold text-dark-dim uppercase tracking-wide px-4 py-2.5">Platform</th>
                        <th className="text-[10px] font-bold text-dark-dim uppercase tracking-wide px-4 py-2.5">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => {
                        const displayState = ITEM_STATE_DISPLAY[item.state] || item.displayState || item.state;
                        const stateColor = ITEM_STATE_COLORS[displayState] || "#8e8e93";
                        return (
                          <tr key={item.id} className="border-b border-dark-border last:border-b-0">
                            <td className="px-4 py-3 text-[13px] text-dark-text">
                              {ITEM_TYPE_LABELS[item.type] || item.type}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-dark-text">
                              {item.versionString || "\u2014"}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-dark-text">
                              {item.platform || "\u2014"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: stateColor }} />
                                <span style={{ color: stateColor }}>{displayState}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
