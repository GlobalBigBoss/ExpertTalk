import { useState } from "react";
import {
  ExternalLink,
  User,
  Lightbulb,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Network,
  List,
  Play,
} from "lucide-react";
import type { VideoAnalysis } from "~/types";
import { getDownloadUrl, getPdfDownloadUrl } from "~/lib/api";
import { MindmapView } from "~/components/mindmap-view";
import { useLocale } from "~/lib/i18n";

interface VideoDetailProps {
  video: VideoAnalysis;
  taskId: string;
  allResults: VideoAnalysis[];
}

export function VideoDetail({ video, taskId, allResults }: VideoDetailProps) {
  const { t } = useLocale();
  const [showTranslation, setShowTranslation] = useState(false);
  const [viewMode, setViewMode] = useState<"detail" | "mindmap">("detail");

  const depthLabel =
    video.depth === 0 ? t("mainVideo") : `${t("depth")} ${video.depth}`;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                  video.depth === 0
                    ? "bg-blue-100 text-blue-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {depthLabel}
              </span>
              {video.ppt_filename && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                  PPT
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {video.title_cn || video.title}
            </h2>
            {video.title_cn && (
              <p className="text-sm text-gray-500 mt-1">{video.title}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View mode toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("detail")}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === "detail"
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <List className="h-3 w-3" />
                {t("list")}
              </button>
              <button
                onClick={() => setViewMode("mindmap")}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  viewMode === "mindmap"
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Network className="h-3 w-3" />
                {t("mindmap")}
              </button>
            </div>

            {/* Actions */}
            {video.ppt_filename && (
              <>
                <a
                  href={getDownloadUrl(taskId, video.video_id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  download
                >
                  <Download className="h-4 w-4" />
                  PPT
                </a>
                <a
                  href={getPdfDownloadUrl(taskId, video.video_id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* YouTube link — prominent bar above content */}
      <a
        href={video.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-red-50 transition-colors group shrink-0"
      >
        <Play className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-sm text-gray-600 group-hover:text-red-700 truncate flex-1">
          {video.video_url}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-gray-400 group-hover:text-red-500 shrink-0" />
      </a>

      {/* Content */}
      {viewMode === "mindmap" ? (
        <div className="flex-1 min-h-0">
          <MindmapView results={allResults} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Points */}
          {video.key_points.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                {t("keyPoints")} ({video.key_points.length})
              </h3>
              <ul className="space-y-2">
                {video.key_points.map((point, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-blue-400"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Mentioned People */}
          {video.mentioned_people.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <User className="h-4 w-4 text-blue-500" />
                {t("mentionedPeople")} ({video.mentioned_people.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {video.mentioned_people.map((person, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="font-medium text-gray-900 text-sm">
                      {person.name_cn} ({person.name})
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{person.context}</p>
                    {person.related_videos.length > 0 && (
                      <span className="inline-block mt-2 text-xs text-blue-600">
                        {person.related_videos.length} {t("relatedVideoCount")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Chinese Translation */}
          {video.transcript_cn && (
            <section>
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700"
              >
                <FileText className="h-4 w-4 text-gray-500" />
                {t("chineseTranslation")}
                {showTranslation ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {showTranslation && (
                <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {video.transcript_cn}
                </div>
              )}
            </section>
          )}

          {/* Slides info */}
          {video.slides.length > 0 && (
            <p className="text-xs text-gray-500">
              PPT {video.slides.length + 3} {t("slidesCount")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
