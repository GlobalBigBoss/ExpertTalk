import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { AppHeader } from "~/components/app-header";
import { VideoSidebar } from "~/components/video-sidebar";
import { PersonDetail } from "~/components/person-detail";
import { VideoDetail } from "~/components/video-detail";
import { useTaskWebSocket } from "~/hooks/use-websocket";
import { getProject } from "~/lib/api";
import { useLocale } from "~/lib/i18n";
import type { TaskProgress, WorkspaceSelection } from "~/types";

export default function Workspace() {
  const { taskId } = useParams();
  const { t } = useLocale();
  const [selection, setSelection] = useState<WorkspaceSelection | null>(null);
  const [initialData, setInitialData] = useState<TaskProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { progress: wsProgress } = useTaskWebSocket(taskId ?? null);

  useEffect(() => {
    if (!taskId) return;
    getProject(taskId)
      .then((data) => {
        setInitialData(data);
        // Auto-select first person
        const mainVideo = data.results?.find((v) => v.depth === 0);
        const firstPerson = mainVideo?.mentioned_people?.[0];
        if (firstPerson && !selection) {
          setSelection({ type: "person", personName: firstPerson.name });
        }
      })
      .catch((e) => setLoadError(e.message));
  }, [taskId]);

  const progress = wsProgress ?? initialData;

  // Auto-select first person when results arrive
  useEffect(() => {
    if (!selection && progress?.results?.length) {
      const mainVideo = progress.results.find((v) => v.depth === 0);
      const firstPerson = mainVideo?.mentioned_people?.[0];
      if (firstPerson) {
        setSelection({ type: "person", personName: firstPerson.name });
      }
    }
  }, [progress?.results?.length]);

  const handleSelectPerson = (personName: string) => {
    setSelection({ type: "person", personName });
  };

  const handleSelectVideo = (videoId: string, personName: string) => {
    setSelection({ type: "video", videoId, personName });
  };

  if (!taskId) {
    return <div className="p-8 text-center text-gray-500">Invalid task ID</div>;
  }

  if (loadError && !progress) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader showBack />
        <div className="p-8 text-center text-red-500">{loadError}</div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader showBack />
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  const results = progress.results || [];
  const projectTitle = results[0]?.title_cn || results[0]?.title || "";

  // Resolve the selected video for "video" selection type
  const selectedVideo =
    selection?.type === "video"
      ? results.find((v) => v.video_id === selection.videoId)
      : null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <AppHeader showBack title={projectTitle} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-80 shrink-0">
          <VideoSidebar
            progress={progress}
            selection={selection}
            onSelectPerson={handleSelectPerson}
            onSelectVideo={handleSelectVideo}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 bg-white overflow-hidden">
          {selection?.type === "video" && selectedVideo ? (
            <VideoDetail
              video={selectedVideo}
              taskId={taskId}
              allResults={results}
            />
          ) : selection?.type === "person" ? (
            <PersonDetail
              personName={selection.personName}
              results={results}
              taskId={taskId}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              {results.length ? (
                t("noPersonSelected")
              ) : progress.status === "processing" ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <p>{progress.current_step || t("processing")}</p>
                </div>
              ) : (
                t("noPersonSelected")
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
