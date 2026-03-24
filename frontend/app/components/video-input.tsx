import { useState } from "react";
import { Search, Loader2, Settings2, Wifi, WifiOff, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { testConnectivity } from "~/lib/api";
import { useLocale } from "~/lib/i18n";
import type { ConnectivityResult } from "~/types";

interface VideoInputProps {
  onSubmit: (url: string, maxDepth: number, maxVideosPerPerson: number) => void;
  loading: boolean;
}

export function VideoInput({ onSubmit, loading }: VideoInputProps) {
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxVideos, setMaxVideos] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectResult, setConnectResult] = useState<ConnectivityResult | null>(null);
  const [connectError, setConnectError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim(), maxDepth, maxVideos);
    }
  };

  const handleTestConnect = async () => {
    setTesting(true);
    setConnectError("");
    setConnectResult(null);
    try {
      const result = await testConnectivity();
      setConnectResult(result);
    } catch (e: any) {
      setConnectError(e.message || t("connectTestFailed"));
    } finally {
      setTesting(false);
    }
  };

  const StatusIcon = ({ status }: { status: "ok" | "fail" }) =>
    status === "ok" ? (
      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
    );

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("inputPlaceholder")}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              disabled={loading}
              required
            />
          </div>
          <button
            type="button"
            onClick={handleTestConnect}
            disabled={testing}
            className="px-3 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title={t("testConnection")}
          >
            {testing ? (
              <Loader2 className="h-5 w-5 text-gray-600 animate-spin" />
            ) : connectResult ? (
              connectResult.google.status === "ok" && connectResult.youtube.status === "ok" ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )
            ) : (
              <Wifi className="h-5 w-5 text-gray-600" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            title={t("settings")}
          >
            <Settings2 className="h-5 w-5 text-gray-600" />
          </button>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("processingBtn")}
              </>
            ) : (
              t("startAnalysis")
            )}
          </button>
        </div>

        {/* Connectivity test results */}
        {(connectResult || connectError) && (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">{t("connectivityTest")}</span>
            </div>

            {connectError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{connectError}</span>
              </div>
            )}

            {connectResult && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {/* Proxy */}
                <div className="flex items-center gap-2">
                  {connectResult.proxy !== "未配置" && connectResult.proxy !== "Not configured" ? (
                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-gray-600">{t("proxy")}:</span>
                  <span className={`font-mono text-xs ${connectResult.proxy !== "未配置" && connectResult.proxy !== "Not configured" ? "text-gray-800" : "text-amber-600"}`}>
                    {connectResult.proxy === "未配置" ? t("notConfigured") : connectResult.proxy}
                  </span>
                </div>

                {/* Google */}
                <div className="flex items-center gap-2">
                  <StatusIcon status={connectResult.google.status} />
                  <span className="text-gray-600">Google:</span>
                  {connectResult.google.status === "ok" ? (
                    <span className="text-green-600">
                      {t("accessible")} ({connectResult.google.latency_ms}ms)
                    </span>
                  ) : (
                    <span className="text-red-600 text-xs truncate max-w-48" title={connectResult.google.error}>
                      {connectResult.google.error}
                    </span>
                  )}
                </div>

                {/* YouTube */}
                <div className="flex items-center gap-2">
                  <StatusIcon status={connectResult.youtube.status} />
                  <span className="text-gray-600">YouTube:</span>
                  {connectResult.youtube.status === "ok" ? (
                    <span className="text-green-600">
                      {t("accessible")} ({connectResult.youtube.latency_ms}ms)
                    </span>
                  ) : (
                    <span className="text-red-600 text-xs truncate max-w-48" title={connectResult.youtube.error}>
                      {connectResult.youtube.error}
                    </span>
                  )}
                </div>

                {/* yt-dlp */}
                <div className="flex items-center gap-2">
                  <StatusIcon status={connectResult.ytdlp.status} />
                  <span className="text-gray-600">yt-dlp:</span>
                  {connectResult.ytdlp.status === "ok" ? (
                    <span className="text-green-600">
                      {t("normal")} ({connectResult.ytdlp.latency_ms}ms)
                    </span>
                  ) : (
                    <span className="text-red-600 text-xs truncate max-w-48" title={connectResult.ytdlp.error}>
                      {connectResult.ytdlp.error}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {showSettings && (
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("recursionDepth")}: {maxDepth}
              </label>
              <input
                type="range"
                min={1}
                max={3}
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t("recursionDepthHint")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("videosPerPerson")}: {maxVideos}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={maxVideos}
                onChange={(e) => setMaxVideos(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t("videosPerPersonHint")}
              </p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
