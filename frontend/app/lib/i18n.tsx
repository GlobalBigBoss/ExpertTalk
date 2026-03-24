import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "zh" | "en";

const translations = {
  zh: {
    // Brand
    brand: "行家说",
    tagline: "行家懂行家",

    // Navigation
    home: "首页",
    back: "返回",
    backToProjects: "返回项目列表",

    // Project list
    myProjects: "我的项目",
    newProject: "新建项目",
    noProjects: "还没有项目",
    noProjectsHint: "在上方粘贴 YouTube 视频链接开始分析",
    deleteProject: "删除项目",
    deleteConfirm: "确定删除此项目？",
    open: "打开",

    // Project status
    pending: "等待中",
    processing: "处理中",
    completed: "已完成",
    failed: "失败",

    // Video input
    inputPlaceholder: "请粘贴 YouTube 视频链接...",
    startAnalysis: "开始分析",
    processingBtn: "处理中",
    settings: "设置",
    testConnection: "测试网络连接",
    recursionDepth: "递归深度",
    recursionDepthHint: "搜索相关人物视频的深度",
    videosPerPerson: "每人视频数",
    videosPerPersonHint: "每个提及人物最多搜索的采访视频数",

    // Connectivity
    connectivityTest: "网络连通性测试",
    proxy: "代理",
    notConfigured: "未配置",
    accessible: "可访问",
    normal: "正常",
    connectTestFailed: "连接测试失败",

    // Pipeline
    fetchingVideo: "获取视频信息",
    aiAnalysis: "AI 内容分析",
    generatePpt: "生成 PPT",
    searchPeople: "搜索相关人物视频",
    cached: "已缓存，跳过",

    // Workspace
    videoList: "视频列表",
    allVideos: "全部",
    mainVideo: "主视频",
    relatedVideos: "相关视频",
    filterByDepth: "按深度筛选",
    noVideoSelected: "请在左侧选择一个视频查看详情",
    videos: "个视频",

    // Person-centric
    personList: "人物列表",
    noPeopleYet: "暂无人物信息",
    personBackground: "人物背景",
    youtubeVideos: "相关视频链接",
    viewpoints: "观点",
    noPersonSelected: "请在左侧选择人物查看详情",
    videoCount: "个视频",
    sourceVideo: "来源视频",
    morePoints: "更多",
    mainVideoOverview: "主视频概要",

    // Video detail
    keyPoints: "核心观点",
    mentionedPeople: "提到的人物",
    chineseTranslation: "中文翻译",
    relatedVideoCount: "个相关视频",
    slidesCount: "页（含封面、目录和结束页）",
    downloadPpt: "下载 PPT",
    downloadPdf: "下载 PDF",
    openOnYoutube: "在 YouTube 打开",
    depth: "层",
    mindmap: "脑图",
    list: "列表",
    knowledgeMap: "知识脑图",
    fitCanvas: "适应画布",
    fullscreen: "全屏",
    exitFullscreen: "退出全屏",
    renderingMindmap: "正在渲染脑图...",
    renderFailed: "渲染脑图失败",

    // Time
    justNow: "刚刚",
    minutesAgo: "分钟前",
    hoursAgo: "小时前",
    daysAgo: "天前",

    // Language
    switchLang: "English",
  },
  en: {
    // Brand
    brand: "ExpertTalk",
    tagline: "Like minds",

    // Navigation
    home: "Home",
    back: "Back",
    backToProjects: "Back to projects",

    // Project list
    myProjects: "My Projects",
    newProject: "New Project",
    noProjects: "No projects yet",
    noProjectsHint: "Paste a YouTube video URL above to start analyzing",
    deleteProject: "Delete project",
    deleteConfirm: "Delete this project?",
    open: "Open",

    // Project status
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",

    // Video input
    inputPlaceholder: "Paste a YouTube video URL...",
    startAnalysis: "Analyze",
    processingBtn: "Processing",
    settings: "Settings",
    testConnection: "Test connection",
    recursionDepth: "Recursion Depth",
    recursionDepthHint: "Depth for searching related person videos",
    videosPerPerson: "Videos per Person",
    videosPerPersonHint: "Max interview videos to search per mentioned person",

    // Connectivity
    connectivityTest: "Connectivity Test",
    proxy: "Proxy",
    notConfigured: "Not configured",
    accessible: "Accessible",
    normal: "Normal",
    connectTestFailed: "Connection test failed",

    // Pipeline
    fetchingVideo: "Fetching video",
    aiAnalysis: "AI Analysis",
    generatePpt: "Generate PPT",
    searchPeople: "Search related videos",
    cached: "Cached, skipped",

    // Workspace
    videoList: "Videos",
    allVideos: "All",
    mainVideo: "Main Video",
    relatedVideos: "Related Videos",
    filterByDepth: "Filter by depth",
    noVideoSelected: "Select a video from the sidebar to view details",
    videos: "videos",

    // Person-centric
    personList: "People",
    noPeopleYet: "No people found yet",
    personBackground: "Background",
    youtubeVideos: "Related Videos",
    viewpoints: "viewpoints",
    noPersonSelected: "Select a person from the sidebar to view details",
    videoCount: "videos",
    sourceVideo: "Source",
    morePoints: "more",
    mainVideoOverview: "Video Overview",

    // Video detail
    keyPoints: "Key Points",
    mentionedPeople: "Mentioned People",
    chineseTranslation: "Chinese Translation",
    relatedVideoCount: "related videos",
    slidesCount: "slides (incl. cover, TOC and end page)",
    downloadPpt: "Download PPT",
    downloadPdf: "Download PDF",
    openOnYoutube: "Open on YouTube",
    depth: "depth",
    mindmap: "Mindmap",
    list: "List",
    knowledgeMap: "Knowledge Map",
    fitCanvas: "Fit to canvas",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    renderingMindmap: "Rendering mindmap...",
    renderFailed: "Failed to render mindmap",

    // Time
    justNow: "just now",
    minutesAgo: "min ago",
    hoursAgo: "hr ago",
    daysAgo: "days ago",

    // Language
    switchLang: "中文",
  },
} as const;

type TranslationKey = keyof (typeof translations)["zh"];

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[locale][key] || key;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
