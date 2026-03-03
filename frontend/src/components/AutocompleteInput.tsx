import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { SuggestCandidate, suggestSymbols } from "../api";
import { t } from "../i18n";
import { Badge } from "./Badge";
import { Input } from "./Input";

export type AutocompleteInputProps = {
  label: string;
  placeholder?: string;
  value: string;
  repoId: string;
  sessionId?: string;
  topN?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (candidate: SuggestCandidate) => void;
};

export function AutocompleteInput({
  label,
  placeholder,
  value,
  repoId,
  sessionId,
  topN = 10,
  disabled,
  onChange,
  onSelect
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<SuggestCandidate[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!repoId || !value.trim() || disabled) {
      setCandidates([]);
      setOpen(false);
      return;
    }

    const current = ++reqSeq.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        let result = await suggestSymbols(repoId, value, "prefix", topN, sessionId);
        if (!result.length) {
          result = await suggestSymbols(repoId, value, "fuzzy", topN, sessionId);
        }
        if (reqSeq.current !== current) {
          return;
        }
        setCandidates(result);
        setActiveIndex(0);
        setOpen(result.length > 0);
      } catch {
        if (reqSeq.current === current) {
          setCandidates([]);
          setOpen(false);
        }
      } finally {
        if (reqSeq.current === current) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [repoId, sessionId, value, topN, disabled]);

  const activeCandidate = useMemo(() => candidates[activeIndex], [activeIndex, candidates]);

  const pick = (candidate: SuggestCandidate) => {
    onChange(candidate.qualified_name);
    onSelect(candidate);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !candidates.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % candidates.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + candidates.length) % candidates.length);
      return;
    }

    if (event.key === "Enter") {
      if (activeCandidate) {
        event.preventDefault();
        pick(activeCandidate);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="autocomplete-wrap">
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(candidates.length > 0)}
        onKeyDown={onKeyDown}
      />
      {loading && <span className="muted-text">{t("autocomplete.suggesting")}</span>}
      {open && candidates.length > 0 && (
        <div className="suggest-menu" role="listbox">
          {candidates.map((candidate, index) => (
            <button
              key={`${candidate.qualified_name}-${index}`}
              type="button"
              className={`suggest-item ${index === activeIndex ? "active" : ""}`.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(candidate)}
            >
              <div className="suggest-primary">
                <span className="suggest-qname mono">{candidate.qualified_name}</span>
                <Badge kind="type">{candidate.type}</Badge>
              </div>
              <div className="suggest-secondary mono">
                <span>
                  {candidate.source}:{candidate.lines}
                </span>
                <span>{t("autocomplete.score", { score: candidate.score.toFixed(2) })}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

