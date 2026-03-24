export interface PersonInfo {
  name: string;
  name_cn: string;
  context: string;
  related_videos: string[];
  thumbnail_url: string;
}

export interface SlideContent {
  slide_type: string;
  title: string;
  bullet_points: string[];
  quote: string;
  speaker: string;
  notes: string;
  image_url: string;
  highlight_text: string;
  left_title: string;
  right_title: string;
  left_points: string[];
  right_points: string[];
}

export interface VideoAnalysis {
  video_id: string;
  video_url: string;
  title: string;
  title_cn: string;
  transcript: string;
  transcript_cn: string;
  key_points: string[];
  mentioned_people: PersonInfo[];
  slides: SlideContent[];
  ppt_filename: string;
  depth: number;
}

export interface PipelineStep {
  key: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  detail: string;
}

export interface TaskProgress {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  current_step: string;
  progress_pct: number;
  total_videos: number;
  processed_videos: number;
  results: VideoAnalysis[];
  error: string;
  steps: PipelineStep[];
}

export interface TaskCreate {
  video_url: string;
  max_depth: number;
  max_videos_per_person: number;
}

export interface ConnectivityTestResult {
  status: "ok" | "fail";
  latency_ms?: number;
  http_code?: number;
  error?: string;
  title?: string;
}

export interface ConnectivityResult {
  proxy: string;
  google: ConnectivityTestResult;
  youtube: ConnectivityTestResult;
  ytdlp: ConnectivityTestResult;
}

export type WorkspaceSelection =
  | { type: "person"; personName: string }
  | { type: "video"; videoId: string; personName: string };

export interface ProjectSummary {
  id: string;
  video_url: string;
  title: string;
  title_cn: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: number;
  updated_at: number;
  video_count: number;
}
