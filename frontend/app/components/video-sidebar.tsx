import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Video,
  FileText,
} from "lucide-react";
import type { TaskProgress, VideoAnalysis, PersonInfo, WorkspaceSelection } from "~/types";
import { useLocale } from "~/lib/i18n";

type SidebarTab = "main" | "people";

interface VideoSidebarProps {
  progress: TaskProgress;
  selection: WorkspaceSelection | null;
  onSelectPerson: (personName: string) => void;
  onSelectVideo: (videoId: string, personName: string) => void;
}

function SmallStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />;
    case "in_progress":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
    default:
      return <Clock className="h-3 w-3 text-gray-300 shrink-0" />;
  }
}

function getPersonVideos(person: PersonInfo, results: VideoAnalysis[]): VideoAnalysis[] {
  return results.filter((v) => person.related_videos.includes(v.video_url));
}

export function VideoSidebar({
  progress,
  selection,
  onSelectPerson,
  onSelectVideo,
}: VideoSidebarProps) {
  const { t } = useLocale();
  const [showSteps, setShowSteps] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("people");

  const isProcessing = progress.status === "processing";
  const results = progress.results || [];
  const mainVideo = results.find((v) => v.depth === 0);
  const people = mainVideo?.mentioned_people || [];

  const progressColor =
    progress.status === "completed"
      ? "bg-green-500"
      : progress.status === "failed"
        ? "bg-red-500"
        : "bg-blue-500";

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Progress section */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
          ) : progress.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : progress.status === "failed" ? (
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-gray-400 shrink-0" />
          )}
          <span className="text-xs text-gray-600 truncate flex-1">
            {progress.current_step || t(progress.status as any)}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {progress.processed_videos}/{progress.total_videos || "?"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(progress.progress_pct, 100)}%` }}
          />
        </div>

        {progress.steps && progress.steps.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              {showSteps ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {progress.steps.length} steps
            </button>
            {showSteps && (
              <div className="mt-1 space-y-0.5">
                {progress.steps.map((step) => (
                  <div key={step.key} className="flex items-center gap-1.5 text-xs">
                    <SmallStatusIcon status={step.status} />
                    <span className={step.status === "in_progress" ? "text-blue-600 font-medium" : "text-gray-500"}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-gray-100 flex gap-1">
        <button
          onClick={() => setActiveTab("main")}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            activeTab === "main"
              ? "bg-blue-100 text-blue-700 font-medium"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          {t("mainVideo")}
        </button>
        <button
          onClick={() => setActiveTab("people")}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            activeTab === "people"
              ? "bg-blue-100 text-blue-700 font-medium"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          {t("mentionedPeople")}
          {people.length > 0 && (
            <span className="ml-1 text-[10px] opacity-70">{people.length}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "main" ? (
          /* ── Main video tab ── */
          mainVideo ? (
            <MainVideoItem
              video={mainVideo}
              isSelected={
                selection?.type === "video" && selection.videoId === mainVideo.video_id
              }
              onSelect={() => onSelectVideo(mainVideo.video_id, "")}
            />
          ) : (
            <div className="p-4 text-center text-xs text-gray-400">
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("processing")}...
                </div>
              ) : (
                t("noPeopleYet")
              )}
            </div>
          )
        ) : (
          /* ── People tab ── */
          people.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("processing")}...
                </div>
              ) : (
                t("noPeopleYet")
              )}
            </div>
          ) : (
            <div>
              {people.map((person) => (
                <PersonGroup
                  key={person.name}
                  person={person}
                  results={results}
                  selection={selection}
                  isProcessing={isProcessing}
                  onSelectPerson={onSelectPerson}
                  onSelectVideo={onSelectVideo}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ── Main video entry ── */
function MainVideoItem({
  video,
  isSelected,
  onSelect,
}: {
  video: VideoAnalysis;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-3 border-l-2 transition-colors ${
        isSelected
          ? "bg-blue-50 border-blue-500"
          : "hover:bg-gray-50 border-transparent"
      }`}
    >
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-blue-500 shrink-0" />
        <span className={`text-sm font-semibold truncate ${isSelected ? "text-blue-700" : "text-gray-900"}`}>
          {video.title_cn || video.title}
        </span>
      </div>
      {video.title_cn && video.title && (
        <p className="text-[11px] text-gray-400 mt-0.5 pl-6 truncate">{video.title}</p>
      )}
      <div className="flex items-center gap-3 mt-1.5 pl-6 text-[10px] text-gray-400">
        {video.key_points.length > 0 && (
          <span>{video.key_points.length} {t("viewpoints")}</span>
        )}
        {video.mentioned_people.length > 0 && (
          <span className="flex items-center gap-0.5">
            <User className="h-2.5 w-2.5" />
            {video.mentioned_people.length}
          </span>
        )}
        {video.ppt_filename && <FileText className="h-3 w-3 text-green-500" />}
      </div>
    </button>
  );
}

/* ── Person group with video titles underneath ── */
function PersonGroup({
  person,
  results,
  selection,
  isProcessing,
  onSelectPerson,
  onSelectVideo,
}: {
  person: PersonInfo;
  results: VideoAnalysis[];
  selection: WorkspaceSelection | null;
  isProcessing: boolean;
  onSelectPerson: (name: string) => void;
  onSelectVideo: (videoId: string, personName: string) => void;
}) {
  const { t } = useLocale();
  const personVideos = getPersonVideos(person, results);

  const isPersonSelected =
    selection?.type === "person" && selection.personName === person.name;
  const isGroupActive =
    isPersonSelected ||
    (selection?.type === "video" && selection.personName === person.name);

  return (
    <div className={`border-b border-gray-100 ${isGroupActive ? "bg-blue-50/40" : ""}`}>
      {/* Person name row */}
      <button
        onClick={() => onSelectPerson(person.name)}
        className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors ${
          isPersonSelected ? "bg-blue-100/60" : "hover:bg-gray-50"
        }`}
      >
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
            isGroupActive ? "bg-blue-200" : "bg-gray-100"
          }`}
        >
          <User className={`h-3.5 w-3.5 ${isGroupActive ? "text-blue-600" : "text-gray-500"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm font-semibold block truncate ${
              isGroupActive ? "text-blue-700" : "text-gray-900"
            }`}
          >
            {person.name_cn || person.name}
          </span>
          {person.name_cn && (
            <span className="text-[11px] text-gray-400 block truncate">{person.name}</span>
          )}
        </div>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 ${
            isPersonSelected ? "text-blue-500" : "text-gray-300"
          }`}
        />
      </button>

      {/* Video titles under this person */}
      {personVideos.length > 0 && (
        <div className="pb-1.5">
          {personVideos.map((video) => {
            const isVideoSelected =
              selection?.type === "video" &&
              selection.videoId === video.video_id &&
              selection.personName === person.name;
            return (
              <button
                key={video.video_id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectVideo(video.video_id, person.name);
                }}
                className={`w-full text-left pl-12 pr-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  isVideoSelected
                    ? "text-blue-700 bg-blue-100/70"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <Video className="h-3 w-3 shrink-0 text-gray-400" />
                <span className={`text-xs truncate ${isVideoSelected ? "font-medium" : ""}`}>
                  {video.title_cn || video.title}
                </span>
                {video.ppt_filename && (
                  <FileText className="h-2.5 w-2.5 text-green-500 shrink-0 ml-auto" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Pending: videos not yet analyzed */}
      {personVideos.length === 0 && person.related_videos.length > 0 && (
        <div className="pl-12 pr-3 pb-2">
          <span className="text-[10px] text-gray-400 italic">
            {isProcessing ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {t("processing")}...
              </span>
            ) : (
              `${person.related_videos.length} ${t("videoCount")}`
            )}
          </span>
        </div>
      )}
    </div>
  );
}
