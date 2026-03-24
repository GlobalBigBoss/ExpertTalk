import { useEffect, useRef, useState, useCallback } from "react";
import type { TaskProgress } from "~/types";
import { getWebSocketUrl } from "~/lib/api";

export function useTaskWebSocket(taskId: string | null) {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const progressRef = useRef<TaskProgress | null>(null);

  const connect = useCallback(() => {
    if (!taskId) return;

    const ws = new WebSocket(getWebSocketUrl(taskId));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TaskProgress;
        setProgress(data);
        progressRef.current = data;
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect if task is still processing (use ref to avoid stale closure)
      if (progressRef.current?.status === "processing") {
        setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [taskId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { progress, connected };
}
