import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  User,
  Lightbulb,
  FileText,
} from "lucide-react";
import type { VideoAnalysis } from "~/types";
import { getDownloadUrl, getPdfDownloadUrl } from "~/lib/api";

interface VideoCardProps {
  video: VideoAnalysis;
  taskId: string;
}

export function VideoCard({ video, taskId }: VideoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const depthLabel =
    video.depth === 0 ? "主视频" : `第 ${video.depth} 层`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
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
                  PPT 已生成
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {video.title_cn || video.title}
            </h3>
            {video.title_cn && (
              <p className="text-sm text-gray-500 truncate mt-0.5">
                {video.title}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
            <a
              href={video.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="在 YouTube 打开"
            >
              <ExternalLink className="h-4 w-4 text-gray-500" />
            </a>
          </div>
        </div>

        {/* Key Points Preview */}
        {video.key_points.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">
                核心观点（{video.key_points.length}）
              </span>
            </div>
            <ul className="space-y-1">
              {video.key_points.slice(0, expanded ? undefined : 3).map((point, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-blue-400"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mentioned People */}
        {video.mentioned_people.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {video.mentioned_people.map((person, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700"
                title={person.context}
              >
                <User className="h-3 w-3" />
                {person.name_cn} ({person.name})
              </span>
            ))}
          </div>
        )}

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" /> 收起
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" /> 展开详情
            </>
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          {/* Full key points */}
          {video.key_points.length > 3 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                全部观点
              </h4>
              <ul className="space-y-1">
                {video.key_points.map((point, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-600 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-blue-400"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Chinese Translation */}
          {video.transcript_cn && (
            <div>
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2"
              >
                <FileText className="h-4 w-4" />
                中文翻译
                {showTranslation ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {showTranslation && (
                <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200 max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {video.transcript_cn}
                </div>
              )}
            </div>
          )}

          {/* People details */}
          {video.mentioned_people.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4" />
                提及人物
              </h4>
              <div className="space-y-2">
                {video.mentioned_people.map((person, i) => (
                  <div
                    key={i}
                    className="text-sm bg-white p-3 rounded-lg border border-gray-200"
                  >
                    <span className="font-medium text-gray-900">
                      {person.name_cn} ({person.name})
                    </span>
                    <p className="text-gray-600 mt-1">{person.context}</p>
                    {person.related_videos.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-blue-600">
                          找到 {person.related_videos.length} 个相关视频
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slides info */}
          {video.slides.length > 0 && (
            <p className="text-xs text-gray-500">
              PPT 共 {video.slides.length + 3} 页（含封面、目录和结束页）
            </p>
          )}
        </div>
      )}
    </div>
  );
}
