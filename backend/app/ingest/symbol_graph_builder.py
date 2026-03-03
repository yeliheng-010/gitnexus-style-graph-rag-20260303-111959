from __future__ import annotations

import fnmatch
import hashlib
import re
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path

from app.ingest.tree_sitter_parser import EdgeDraft, SymbolDraft, UnresolvedRelation, parse_source_file, supported_language


class SymbolGraphBuilder:
    def __init__(self) -> None:
        pass

    def build(
        self,
        repo_id: str,
        repo_root: Path,
        include_globs: list[str],
        exclude_globs: list[str],
        languages: list[str],
    ) -> tuple[list[SymbolDraft], list[EdgeDraft]]:
        symbols: list[SymbolDraft] = []
        unresolved: list[UnresolvedRelation] = []

        all_files = sorted([p for p in repo_root.rglob("*") if p.is_file()])
        for file_path in all_files:
            rel = file_path.relative_to(repo_root).as_posix()
            if not any(fnmatch.fnmatch(rel, pattern) for pattern in include_globs):
                continue
            if any(fnmatch.fnmatch(rel, pattern) for pattern in exclude_globs):
                continue
            lang = supported_language(file_path, languages)
            if not lang:
                continue

            parsed = parse_source_file(repo_id=repo_id, repo_root=repo_root, file_path=file_path, language=lang)
            symbols.extend(parsed.symbols)
            unresolved.extend(parsed.unresolved_relations)

        for symbol in symbols:
            symbol.id = self._symbol_id(symbol)

        qname_to_symbols: dict[str, list[SymbolDraft]] = defaultdict(list)
        name_to_symbols: dict[str, list[SymbolDraft]] = defaultdict(list)
        file_to_symbols: dict[str, list[SymbolDraft]] = defaultdict(list)
        for symbol in symbols:
            qname_to_symbols[symbol.qualified_name].append(symbol)
            name_to_symbols[symbol.name].append(symbol)
            file_to_symbols[symbol.file_path].append(symbol)

        edges: list[EdgeDraft] = []
        seen_edge_keys: set[tuple[str, str, str, str]] = set()

        for relation in unresolved:
            src_symbol = self._choose_symbol(qname_to_symbols.get(relation.src_qname, []))
            if src_symbol is None:
                continue

            dst_symbol = self._resolve_target(
                relation=relation,
                qname_to_symbols=qname_to_symbols,
                name_to_symbols=name_to_symbols,
                file_to_symbols=file_to_symbols,
            )
            if dst_symbol is None:
                continue

            if src_symbol.id == dst_symbol.id:
                continue

            edge_key = (src_symbol.id, dst_symbol.id, relation.rel_type, relation.repo_id)
            if edge_key in seen_edge_keys:
                continue
            seen_edge_keys.add(edge_key)
            edges.append(
                EdgeDraft(
                    src_qname=src_symbol.qualified_name,
                    dst_qname=dst_symbol.qualified_name,
                    type=relation.rel_type,
                    repo_id=relation.repo_id,
                    src_id=src_symbol.id,
                    dst_id=dst_symbol.id,
                )
            )

        return symbols, edges

    def symbol_to_document_text(self, symbol: SymbolDraft) -> str:
        tokens = self._tokenize_identifier(symbol.qualified_name)
        parts = [
            symbol.qualified_name,
            symbol.signature or "",
            symbol.docstring or "",
            " ".join(tokens),
        ]
        return "\n".join([p for p in parts if p]).strip()

    def symbol_to_metadata(self, symbol: SymbolDraft) -> dict[str, object]:
        return asdict(symbol)

    @staticmethod
    def _choose_symbol(candidates: list[SymbolDraft]) -> SymbolDraft | None:
        if not candidates:
            return None
        return sorted(candidates, key=lambda s: (s.start_line, s.end_line))[0]

    def _resolve_target(
        self,
        relation: UnresolvedRelation,
        qname_to_symbols: dict[str, list[SymbolDraft]],
        name_to_symbols: dict[str, list[SymbolDraft]],
        file_to_symbols: dict[str, list[SymbolDraft]],
    ) -> SymbolDraft | None:
        raw_hint = relation.dst_hint.strip().strip("\"'`")
        cleaned = raw_hint.replace("/", ".").replace("..", ".").strip(".")

        direct = self._choose_symbol(qname_to_symbols.get(cleaned, []))
        if direct is not None:
            return direct

        # Same module fallback: module.symbol
        src_module = relation.src_qname.split(".")
        if src_module:
            module_prefix = ".".join(src_module[:-1]) if len(src_module) > 1 else src_module[0]
            maybe_qname = f"{module_prefix}.{cleaned}".strip(".")
            direct = self._choose_symbol(qname_to_symbols.get(maybe_qname, []))
            if direct is not None:
                return direct

        dst_name = cleaned.split(".")[-1]
        name_candidates = list(name_to_symbols.get(dst_name, []))
        if not name_candidates:
            return None

        src_file = relation.src_file
        same_file = [s for s in name_candidates if s.file_path == src_file]
        if same_file:
            return self._choose_symbol(same_file)

        src_dir = Path(src_file).parent.as_posix()
        same_dir = [s for s in name_candidates if Path(s.file_path).parent.as_posix() == src_dir]
        if same_dir:
            return self._choose_symbol(same_dir)

        # Prefer first candidate with matching module fragment
        module_frag = relation.src_qname.split(".")[0]
        module_match = [s for s in name_candidates if s.qualified_name.startswith(module_frag)]
        if module_match:
            return self._choose_symbol(module_match)

        return self._choose_symbol(name_candidates)

    @staticmethod
    def _symbol_id(symbol: SymbolDraft) -> str:
        text = f"{symbol.type}|{symbol.qualified_name}|{symbol.file_path}|{symbol.start_line}"
        return hashlib.sha1(text.encode("utf-8")).hexdigest()

    @staticmethod
    def _tokenize_identifier(identifier: str) -> list[str]:
        if not identifier:
            return []
        normalized = identifier.replace(".", " ").replace("_", " ")
        pieces = re.findall(r"[A-Za-z][a-z]*|[A-Z]+(?=[A-Z][a-z]|\b)|\d+", normalized)
        return [piece.lower() for piece in pieces if piece]
