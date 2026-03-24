import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { TaskProgress, PipelineStep } from "~/types";
import { useLocale } from "~/lib/i18n";

interface ProcessingPipelineProps {
  progress: TaskProgress | null;
}

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-gray-300 shrink-0" />;
  }
}

function stepBgClass(status: PipelineStep["status"]) {
  switch (status) {
    case "in_progress":
      return "bg-blue-50 border-blue-200";
    case "failed":
      return "bg-red-50 border-red-200";
    default:
      return "bg-transparent border-transparent";
  }
}

function stepTextClass(status: PipelineStep["status"]) {
  switch (status) {
    case "completed":
      return "text-gray-500";
    case "in_progress":
      return "text-blue-700 font-medium";
    case "failed":
      return "text-red-600";
    default:
      return "text-gray-400";
  }
}

function detailTextClass(status: PipelineStep["status"]) {
  switch (status) {
    case "in_progress":
      return "text-blue-500";
    case "failed":
      return "text-red-500";
    case "completed":
      return "text-gray-400";
    default:
      return "text-gray-400";
  }
}

export function ProcessingPipeline({ progress }: ProcessingPipelineProps) {
  const { t } = useLocale();
  // Auto-collapse when completed/failed, default expanded when processing
  const [collapsed, setCollapsed] = useState(false);

  if (!progress) return null;

  const statusLabel = (s: string) => t(s as any) || s;
  const isFinished = progress.status === "completed" || progress.status === "failed";

  const statusIcon = () => {
    switch (progress.status) {
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const statusColor = () => {
    switch (progress.status) {
      case "processing":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  const showDetails = !collapsed;

  return (
    <div className="w-full max-w-3xl mx-auto mt-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {/* Status header — clickable to toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between mb-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            {statusIcon()}
            <span className="text-sm font-medium text-gray-700">
              {statusLabel(progress.status)}
            </span>
            {isFinished && collapsed && progress.current_step && (
              <span className="text-xs text-gray-400 ml-2 truncate max-w-xs">
                {progress.current_step}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {progress.processed_videos} / {progress.total_videos || "?"} {t("videos")}
            </span>
            {collapsed ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </button>

        {/* Progress bar — always visible */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${statusColor()}`}
            style={{ width: `${Math.min(progress.progress_pct, 100)}%` }}
          />
        </div>

        {/* Collapsible content */}
        {showDetails && (
          <>
            {/* Pipeline Steps */}
            {progress.steps && progress.steps.length > 0 && (
              <div className="mt-3 space-y-1">
                {progress.steps.map((step) => (
                  <div
                    key={step.key}
                    className={`flex items-start gap-2 text-sm px-2 py-1.5 rounded border transition-colors ${stepBgClass(step.status)}`}
                  >
                    <div className="mt-0.5">
                      <StepIcon status={step.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={stepTextClass(step.status)}>
                        {step.label}
                      </span>
                      {step.detail && (
                        <p className={`text-xs mt-0.5 ${detailTextClass(step.status)}`}>
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current step detail */}
            {progress.current_step && (
              <div className="mt-3 px-2 py-2 bg-gray-50 rounded text-sm text-gray-600">
                {progress.current_step}
              </div>
            )}

            {/* Error message */}
            {progress.error && (
              <p className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">
                {progress.error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
