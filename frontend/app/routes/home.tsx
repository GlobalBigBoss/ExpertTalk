import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { AppHeader } from "~/components/app-header";
import { VideoInput } from "~/components/video-input";
import { useLocale } from "~/lib/i18n";
import { createTask, listProjects, deleteProject } from "~/lib/api";
import type { ProjectSummary } from "~/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "行家说 - ExpertTalk" },
    {
      name: "description",
      content: "分析 YouTube 视频 - 转录、翻译、生成 PPT",
    },
  ];
}

function StatusBadge({ status, t }: { status: ProjectSummary["status"]; t: (k: any) => string }) {
  const config = {
    pending: { icon: Clock, color: "bg-gray-100 text-gray-600" },
    processing: { icon: Loader2, color: "bg-blue-100 text-blue-700" },
    completed: { icon: CheckCircle2, color: "bg-green-100 text-green-700" },
    failed: { icon: XCircle, color: "bg-red-100 text-red-700" },
  };
  const { icon: Icon, color } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {t(status)}
    </span>
  );
}

function timeAgo(timestamp: number, t: (k: any) => string): string {
  const diff = Math.floor((Date.now() / 1000) - timestamp);
  if (diff < 60) return t("justNow");
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t("minutesAgo")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t("hoursAgo")}`;
  return `${Math.floor(diff / 86400)} ${t("daysAgo")}`;
}

export default function Home() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    // Poll for updates every 10s
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleSubmit = async (
    url: string,
    maxDepth: number,
    maxVideosPerPerson: number
  ) => {
    setSubmitting(true);
    setError(null);

    try {
      const result = await createTask({
        video_url: url,
        max_depth: maxDepth,
        max_videos_per_person: maxVideosPerPerson,
      });
      navigate(`/workspace/${result.task_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* New project input */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("newProject")}
          </h2>
          <VideoInput onSubmit={handleSubmit} loading={submitting} />
          {error && (
            <div className="mt-3 max-w-3xl mx-auto p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Project list */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("myProjects")}
          </h2>

          {projects.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">{t("noProjects")}</p>
              <p className="text-sm mt-2">{t("noProjectsHint")}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/workspace/${proj.id}`)}
                  className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  {/* Status */}
                  <StatusBadge status={proj.status} t={t} />

                  {/* Title & URL */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {proj.title_cn || proj.title || proj.video_url}
                    </h3>
                    {(proj.title_cn || proj.title) && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {proj.video_url}
                      </p>
                    )}
                  </div>

                  {/* Video count */}
                  {proj.video_count > 0 && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {proj.video_count} {t("videos")}
                    </span>
                  )}

                  {/* Time */}
                  <span className="text-xs text-gray-400 shrink-0 w-20 text-right">
                    {timeAgo(proj.updated_at, t)}
                  </span>

                  {/* Actions */}
                  <button
                    onClick={(e) => handleDelete(proj.id, e)}
                    className="p-1.5 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title={t("deleteProject")}
                  >
                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
