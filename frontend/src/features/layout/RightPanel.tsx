import { useState } from "react";
import { Citation } from "../../api";
import { Tabs, TabItem } from "../../components/Tabs";
import { GuidePanel } from "../guide/GuidePanel";
import { CallPathTab } from "../path/CallPathTab";
import { TraceTab } from "../trace/TraceTab";
import { CitationsTab } from "../citations/CitationsTab";
import { t } from "../../i18n";

const RIGHT_TABS: TabItem[] = [
  { id: "path", label: t("app.mobileTabs.path") },
  { id: "trace", label: t("app.mobileTabs.trace") },
  { id: "citations", label: t("app.mobileTabs.citations") },
  { id: "guide", label: t("app.mobileTabs.guide") }
];

type RightPanelProps = {
  repoId: string;
  sessionId: string;
  maxHops: number;
  trace: Record<string, unknown>;
  citations: Citation[];
  onTrace: (trace: Record<string, unknown>) => void;
  onCitations: (citations: Citation[]) => void;
  onToast: (kind: "success" | "error" | "info", title: string, message?: string) => void;
  onRequestIngest: () => void;
};

export function RightPanel({
  repoId,
  sessionId,
  maxHops,
  trace,
  citations,
  onTrace,
  onCitations,
  onToast,
  onRequestIngest
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState("path");

  return (
    <Tabs items={RIGHT_TABS} active={activeTab} onChange={setActiveTab}>
      {activeTab === "path" && (
        <CallPathTab
          repoId={repoId}
          sessionId={sessionId}
          maxHops={maxHops}
          onTrace={onTrace}
          onCitations={onCitations}
          onToast={onToast}
          onRequestIngest={onRequestIngest}
        />
      )}
      {activeTab === "trace" && <TraceTab trace={trace} />}
      {activeTab === "citations" && <CitationsTab citations={citations} />}
      {activeTab === "guide" && <GuidePanel compact />}
    </Tabs>
  );
}
