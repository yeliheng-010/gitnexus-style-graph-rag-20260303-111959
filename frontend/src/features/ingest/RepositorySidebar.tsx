import { IngestResult } from "../../api";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Spinner } from "../../components/Spinner";
import { Tooltip } from "../../components/Tooltip";
import { t } from "../../i18n";

export type IngestStats = IngestResult & {
  durationMs: number;
  lastIngestAt: string;
};

type RepositorySidebarProps = {
  repoPath: string;
  onRepoPathChange: (value: string) => void;
  onIngest: () => Promise<void>;
  ingesting: boolean;
  indexed: boolean;
  repoId: string;
  stats?: IngestStats;
  topK: number;
  graphDepth: number;
  hybrid: boolean;
  maxHops: number;
  onTopKChange: (value: number) => void;
  onGraphDepthChange: (value: number) => void;
  onHybridChange: (value: boolean) => void;
  onMaxHopsChange: (value: number) => void;
  error?: string;
};

export function RepositorySidebar({
  repoPath,
  onRepoPathChange,
  onIngest,
  ingesting,
  indexed,
  repoId,
  stats,
  topK,
  graphDepth,
  hybrid,
  maxHops,
  onTopKChange,
  onGraphDepthChange,
  onHybridChange,
  onMaxHopsChange,
  error
}: RepositorySidebarProps) {
  return (
    <div className="panel-stack">
      <Card
        title={t("sidebar.title")}
        subtitle={t("sidebar.subtitle")}
        actions={indexed ? <Badge kind="online">{t("header.indexed")}</Badge> : <Badge kind="offline">{t("header.notIndexed")}</Badge>}
      >
        <Tooltip label={t("sidebar.mountTip")}>
          <p className="muted-text" style={{ margin: "0 0 10px" }}>
            {t("sidebar.repoPathHint")}
          </p>
        </Tooltip>

        <Input
          label={t("sidebar.repoPathLabel")}
          value={repoPath}
          onChange={(event) => onRepoPathChange(event.target.value)}
          placeholder={t("sidebar.repoPathPlaceholder")}
        />

        <div style={{ display: "grid", gap: 8 }}>
          <Button onClick={onIngest} disabled={!repoPath.trim() || ingesting}>
            {ingesting && <Spinner size="sm" />}
            {ingesting ? t("sidebar.ingesting") : t("sidebar.ingest")}
          </Button>
          <p className="muted-text" style={{ margin: 0 }}>
            {t("sidebar.repoId")}: <span className="mono">{repoId || "-"}</span>
          </p>
          {error && <div className="error-banner">{error}</div>}
        </div>
      </Card>

      <Card title={t("sidebar.retrievalTitle")} subtitle={t("sidebar.retrievalSubtitle")}>
        <div className="panel-stack">
          <Input
            label={t("sidebar.topK")}
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(event) => onTopKChange(Math.max(1, Number(event.target.value) || 8))}
          />
          <Input
            label={t("sidebar.graphDepth")}
            type="number"
            min={1}
            max={4}
            value={graphDepth}
            onChange={(event) => onGraphDepthChange(Math.max(1, Number(event.target.value) || 2))}
          />
          <Input
            label={t("sidebar.maxHops")}
            type="number"
            min={1}
            max={20}
            value={maxHops}
            onChange={(event) => onMaxHopsChange(Math.max(1, Number(event.target.value) || 10))}
          />
          <div className="field" style={{ gap: 8 }}>
            <span className="field-label">{t("sidebar.hybridSearch")}</span>
            <label className="switch-row">
              <input type="checkbox" checked={hybrid} onChange={(event) => onHybridChange(event.target.checked)} />
              <span className="muted-text">{t("sidebar.hybridHint")}</span>
            </label>
          </div>
        </div>
      </Card>

      <Card title={t("sidebar.lastIngestTitle")} subtitle={t("sidebar.lastIngestSubtitle")}>
        {stats ? (
          <div className="kv-grid">
            <div className="kv-item">
              <div className="kv-key">{t("sidebar.statSymbols")}</div>
              <div className="kv-value mono">{stats.symbols}</div>
            </div>
            <div className="kv-item">
              <div className="kv-key">{t("sidebar.statEdges")}</div>
              <div className="kv-value mono">{stats.edges}</div>
            </div>
            <div className="kv-item">
              <div className="kv-key">{t("sidebar.statDuration")}</div>
              <div className="kv-value mono">{stats.durationMs} ms</div>
            </div>
            <div className="kv-item">
              <div className="kv-key">{t("sidebar.statLastTime")}</div>
              <div className="kv-value mono">{stats.lastIngestAt}</div>
            </div>
          </div>
        ) : (
          <p className="muted-text" style={{ margin: 0 }}>
            {t("sidebar.noIngest")}
          </p>
        )}
      </Card>
    </div>
  );
}

