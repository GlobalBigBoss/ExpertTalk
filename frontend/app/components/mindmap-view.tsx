import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import type { VideoAnalysis } from "~/types";

interface MindmapViewProps {
  results: VideoAnalysis[];
}

/**
 * Build a markdown-like tree structure for markmap from analysis results.
 * The whole task = one big mind map.
 */
function buildMarkmapMarkdown(results: VideoAnalysis[]): string {
  if (results.length === 0) return "";

  const mainVideo = results.find((r) => r.depth === 0);
  if (!mainVideo) return "";

  const lines: string[] = [];

  // Root: main video title
  const rootTitle = mainVideo.title_cn || mainVideo.title;
  lines.push(`# ${rootTitle}`);

  // Branch 1: Key points
  if (mainVideo.key_points.length > 0) {
    lines.push("");
    lines.push("## 核心观点");
    for (const point of mainVideo.key_points) {
      lines.push(`- ${point}`);
    }
  }

  // Branch 2: People
  if (mainVideo.mentioned_people.length > 0) {
    lines.push("");
    lines.push("## 提到的人物");
    for (const person of mainVideo.mentioned_people) {
      const label = person.name_cn
        ? `${person.name_cn}（${person.name}）`
        : person.name;
      lines.push(`### ${label}`);
      if (person.context) {
        lines.push(`- ${person.context}`);
      }

      // Find child videos for this person (depth > 0)
      const childVideos = results.filter(
        (r) =>
          r.depth > 0 &&
          r.mentioned_people.some(
            (p) => p.name === person.name
          ) === false &&
          // Match by related_videos URL
          person.related_videos.includes(r.video_url)
      );

      // Also try matching by checking if this person was the search source
      const relatedResults = results.filter(
        (r) => r.depth > 0 && person.related_videos.includes(r.video_url)
      );

      if (relatedResults.length > 0) {
        for (const rv of relatedResults) {
          const rvTitle = rv.title_cn || rv.title;
          lines.push(`- **${rvTitle}**`);
          // Add key points of related video as sub-items
          for (const kp of rv.key_points.slice(0, 3)) {
            lines.push(`  - ${kp}`);
          }
        }
      } else if (person.related_videos.length > 0) {
        lines.push(`- _${person.related_videos.length} 个相关视频待分析_`);
      }
    }
  }

  // Branch 3: Slides summary
  if (mainVideo.slides.length > 0) {
    lines.push("");
    lines.push("## PPT 结构");
    for (const slide of mainVideo.slides) {
      if (
        slide.slide_type === "section_title" ||
        slide.slide_type === "title"
      ) {
        lines.push(`### ${slide.title}`);
      } else if (slide.slide_type === "quote" && slide.quote) {
        lines.push(`- _"${slide.quote}"_`);
      } else if (slide.title) {
        lines.push(`- ${slide.title}`);
      }
    }
  }

  return lines.join("\n");
}

export function MindmapView({ results }: MindmapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isClient, setIsClient] = useState(false);

  // SSR guard — markmap only works in browser
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !svgRef.current || results.length === 0) return;

    let cancelled = false;

    async function render() {
      try {
        const { Transformer } = await import("markmap-lib");
        const { Markmap } = await import("markmap-view");

        if (cancelled || !svgRef.current) return;

        const markdown = buildMarkmapMarkdown(results);
        if (!markdown) {
          setLoading(false);
          return;
        }

        const transformer = new Transformer();
        const { root } = transformer.transform(markdown);

        // Clear previous
        svgRef.current.innerHTML = "";

        const mm = Markmap.create(svgRef.current, {
          autoFit: true,
          duration: 300,
          maxWidth: 300,
          paddingX: 16,
        }, root);

        mmRef.current = mm;
        setLoading(false);
        setError("");
      } catch (e: any) {
        console.error("Mindmap render error:", e);
        setError(e.message || "渲染脑图失败");
        setLoading(false);
      }
    }

    setLoading(true);
    render();

    return () => {
      cancelled = true;
    };
  }, [results, isClient]);

  const handleFit = () => {
    mmRef.current?.fit();
  };

  if (!isClient || results.length === 0) return null;

  const containerClass = expanded
    ? "fixed inset-4 z-50 bg-white rounded-xl border border-gray-200 shadow-2xl flex flex-col"
    : "w-full h-full flex flex-col bg-white overflow-hidden";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <h3 className="text-sm font-semibold text-gray-700">
          知识脑图
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFit}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            title="适应画布"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            title={expanded ? "退出全屏" : "全屏"}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4 text-gray-500" />
            ) : (
              <Maximize2 className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* SVG container */}
      <div className={`relative flex-1 min-h-0 bg-gray-50`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            正在渲染脑图...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-500">
            {error}
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ display: loading ? "none" : "block" }}
        />
      </div>

      {/* Fullscreen backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/30 -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
