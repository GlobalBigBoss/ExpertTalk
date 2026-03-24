import { Link } from "react-router";
import { ArrowLeft, Globe } from "lucide-react";
import { useLocale } from "~/lib/i18n";

interface AppHeaderProps {
  showBack?: boolean;
  title?: string;
}

export function AppHeader({ showBack, title }: AppHeaderProps) {
  const { locale, setLocale, t } = useLocale();

  const toggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <Link
              to="/"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={t("backToProjects")}
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              {t("brand")}
            </h1>
            <span className="text-sm text-gray-400 hidden sm:inline">
              {t("tagline")}
            </span>
          </div>
          {title && (
            <>
              <span className="text-gray-300 hidden sm:inline">/</span>
              <span className="text-sm font-medium text-gray-600 truncate max-w-xs hidden sm:inline">
                {title}
              </span>
            </>
          )}
        </div>

        <button
          onClick={toggleLocale}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
        >
          <Globe className="h-4 w-4" />
          {t("switchLang")}
        </button>
      </div>
    </header>
  );
}
