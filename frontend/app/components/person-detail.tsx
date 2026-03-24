import { useState } from "react";
import {
  ExternalLink,
  User,
  Lightbulb,
  FileText,
  Download,
  Play,
  ChevronDown,
  ChevronUp,
  Network,
  List,
} from "lucide-react";
import type { VideoAnalysis, PersonInfo } from "~/types";
import { getDownloadUrl, getPdfDownloadUrl } from "~/lib/api";
import { MindmapView } from "~/components/mindmap-view";
import { useLocale } from "~/lib/i18n";

interface PersonDetailProps {
  personName: string;
  results: VideoAnalysis[];
  taskId: string;
}

function findPersonInfo(name: string, results: VideoAnalysis[]): PersonInfo | null {
  for (const video of results) {
    for (const person of video.mentioned_people) {
      if (person.name === name) return person;
    }
  }
  return null;
}

function getPersonVideos(personInfo: PersonInfo, results: VideoAnalysis[]): VideoAnalysis[] {
  return results.filter((v) => personInfo.related_videos.includes(v.video_url));
}

export function PersonDetail({ personName, results, taskId }: PersonDetailProps) {
  const { t } = useLocale();
  const [viewMode, setViewMode] = useState<"detail" | "mindmap">("detail");

  const personInfo = findPersonInfo(personName, results);
  if (!personInfo) return null;

  const personVideos = getPersonVideos(personInfo, results);

  return (
    <div className="h-full flex flex-col">
      {/* Header — person name prominent */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-11 w-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 truncate">
                  {personInfo.name_cn || personInfo.name}
                </h2>
                {personInfo.name_cn && (
                  <p className="text-sm text-gray-500">{personInfo.name}</p>
                )}
              </div>
            </div>
            {personInfo.context && (
              <p className="text-sm text-gray-600 mt-2 ml-14">{personInfo.context}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "mindmap" ? (
        <div className="flex-1 min-h-0">
          <MindmapView results={results} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* One link + one detail per video */}
          {personVideos.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {personVideos.map((video) => (
                <VideoSection key={video.video_id} video={video} taskId={taskId} />
              ))}
            </div>
          ) : (
            /* Videos not yet analyzed — show raw links */
            personInfo.related_videos.length > 0 && (
              <div className="p-6 space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Play className="h-4 w-4 text-red-500" />
                  {t("youtubeVideos")} ({personInfo.related_videos.length})
                </h3>
                {personInfo.related_videos.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-red-50 transition-colors group"
                  >
                    <Play className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-sm text-gray-600 group-hover:text-red-700 truncate flex-1">
                      {url}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** One video section: YouTube link on top, detail below */
function VideoSection({ video, taskId }: { video: VideoAnalysis; taskId: string }) {
  const { t } = useLocale();
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div>
      {/* YouTube link bar */}
      <a
        href={video.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 hover:bg-red-50 transition-colors group"
      >
        <Play className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-sm font-medium text-gray-700 group-hover:text-red-700 truncate flex-1">
          {video.title_cn || video.title}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-gray-400 group-hover:text-red-500 shrink-0" />
      </a>

      {/* Detail content */}
      <div className="px-6 py-4 space-y-4">
        {/* Key Points */}
        {video.key_points.length > 0 && (
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              {t("keyPoints")} ({video.key_points.length})
            </h4>
            <ul className="space-y-1.5">
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

        {/* Downloads */}
        {video.ppt_filename && (
          <div className="flex items-center gap-2">
            <a
              href={getDownloadUrl(taskId, video.video_id)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              download
            >
              <Download className="h-3.5 w-3.5" />
              PPT
            </a>
            <a
              href={getPdfDownloadUrl(taskId, video.video_id)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </a>
          </div>
        )}

        {/* Chinese translation */}
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
              <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-96 overflow-y-auto whitespace-pre-wrap">
                {video.transcript_cn}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
