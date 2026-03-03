import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { t } from "../../i18n";

type HeaderBarProps = {
  repoId: string;
  indexed: boolean;
  symbols?: number;
  edges?: number;
  lastIngestAt?: string;
  onOpenGuide: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function HeaderBar({
  repoId,
  indexed,
  symbols,
  edges,
  lastIngestAt,
  onOpenGuide,
  theme,
  onToggleTheme
}: HeaderBarProps) {
  return (
    <header className="sticky-header">
      <div className="header-title">
        <h1>{t("header.title")}</h1>
        <p className="header-subtitle">{t("header.subtitle")}</p>
      </div>

      <div className="repo-pill-row">
        <Badge kind={indexed ? "online" : "offline"}>{indexed ? t("header.indexed") : t("header.notIndexed")}</Badge>
        <Badge>
          {t("header.repoId")}: <span className="mono">{repoId || "-"}</span>
        </Badge>
        <Badge>
          {t("header.symbols")}: {symbols ?? 0}
        </Badge>
        <Badge>
          {t("header.edges")}: {edges ?? 0}
        </Badge>
        {lastIngestAt && (
          <Badge>
            {t("header.last")}: {lastIngestAt}
          </Badge>
        )}
      </div>

      <div className="header-actions">
        <Button variant="secondary" size="sm" onClick={onOpenGuide}>
          {t("header.helpGuide")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToggleTheme}>
          {t("header.themeLabel", { theme: theme === "light" ? t("header.light") : t("header.dark") })}
        </Button>
      </div>
    </header>
  );
}

