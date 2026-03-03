from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Any

import kuzu

from app.ingest.tree_sitter_parser import EdgeDraft, SymbolDraft


class KuzuGraphStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = kuzu.Database(str(db_path))
        self.conn = kuzu.Connection(self.db)
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.execute(
            """
            CREATE NODE TABLE IF NOT EXISTS Symbol(
                id STRING PRIMARY KEY,
                repo_id STRING,
                type STRING,
                name STRING,
                qualified_name STRING,
                file_path STRING,
                start_line INT64,
                end_line INT64,
                signature STRING,
                docstring STRING,
                code_snippet STRING
            )
            """
        )
        self.conn.execute(
            """
            CREATE REL TABLE IF NOT EXISTS Edge(
                FROM Symbol TO Symbol,
                type STRING,
                repo_id STRING
            )
            """
        )
        self._safe_execute("CREATE INDEX symbol_qname_idx IF NOT EXISTS FOR (s:Symbol) ON (s.qualified_name)")
        self._safe_execute("CREATE INDEX symbol_name_idx IF NOT EXISTS FOR (s:Symbol) ON (s.name)")
        self._safe_execute("CREATE INDEX symbol_file_idx IF NOT EXISTS FOR (s:Symbol) ON (s.file_path)")
        self._safe_execute("CREATE INDEX symbol_repo_idx IF NOT EXISTS FOR (s:Symbol) ON (s.repo_id)")

    def _safe_execute(self, query: str) -> None:
        try:
            self.conn.execute(query)
        except Exception:
            # Index syntax differs between Kuzu versions; ingestion still works without secondary indexes.
            pass

    def clear_repo(self, repo_id: str) -> None:
        self.conn.execute(f"MATCH (:Symbol)-[e:Edge]->(:Symbol) WHERE e.repo_id = {self._q(repo_id)} DELETE e")
        self.conn.execute(f"MATCH (s:Symbol) WHERE s.repo_id = {self._q(repo_id)} DELETE s")

    def upsert_graph(self, symbols: list[SymbolDraft], edges: list[EdgeDraft]) -> None:
        for symbol in symbols:
            self._upsert_symbol(symbol)
        for edge in edges:
            self._create_edge(edge)

    def _upsert_symbol(self, symbol: SymbolDraft) -> None:
        query = (
            "CREATE (s:Symbol {"
            + f"id: {self._q(symbol.id)}, "
            + f"repo_id: {self._q(symbol.repo_id)}, "
            + f"type: {self._q(symbol.type)}, "
            + f"name: {self._q(symbol.name)}, "
            + f"qualified_name: {self._q(symbol.qualified_name)}, "
            + f"file_path: {self._q(symbol.file_path)}, "
            + f"start_line: {int(symbol.start_line)}, "
            + f"end_line: {int(symbol.end_line)}, "
            + f"signature: {self._q(symbol.signature)}, "
            + f"docstring: {self._q(symbol.docstring)}, "
            + f"code_snippet: {self._q(symbol.code_snippet)}"
            + "})"
        )
        self.conn.execute(query)

    def _create_edge(self, edge: EdgeDraft) -> None:
        query = f"""
        MATCH (a:Symbol {{id: {self._q(edge.src_id)}}}), (b:Symbol {{id: {self._q(edge.dst_id)}}})
        CREATE (a)-[:Edge {{type: {self._q(edge.type)}, repo_id: {self._q(edge.repo_id)}}}]->(b)
        """
        self.conn.execute(query)

    def count_repo(self, repo_id: str) -> tuple[int, int]:
        symbol_res = self.conn.execute(
            f"MATCH (s:Symbol) WHERE s.repo_id = {self._q(repo_id)} RETURN count(s) AS c"
        )
        edge_res = self.conn.execute(
            "MATCH (a:Symbol)-[e:Edge]->(b:Symbol) "
            f"WHERE e.repo_id = {self._q(repo_id)} RETURN count(e) AS c"
        )
        symbol_count = self._single_int(symbol_res)
        edge_count = self._single_int(edge_res)
        return symbol_count, edge_count

    def get_symbols(self, repo_id: str) -> list[dict[str, Any]]:
        query = (
            "MATCH (s:Symbol) WHERE s.repo_id = "
            + self._q(repo_id)
            + " RETURN s.id, s.repo_id, s.type, s.name, s.qualified_name, s.file_path, "
            "s.start_line, s.end_line, s.signature, s.docstring, s.code_snippet"
        )
        rows = self._rows(self.conn.execute(query))
        return [
            {
                "id": row[0],
                "repo_id": row[1],
                "type": row[2],
                "name": row[3],
                "qualified_name": row[4],
                "file_path": row[5],
                "start_line": int(row[6]),
                "end_line": int(row[7]),
                "signature": row[8] or "",
                "docstring": row[9] or "",
                "code_snippet": row[10] or "",
            }
            for row in rows
        ]

    def get_symbol_by_qname(self, repo_id: str, qname: str) -> dict[str, Any] | None:
        query = (
            "MATCH (s:Symbol) WHERE s.repo_id = "
            + self._q(repo_id)
            + " AND s.qualified_name = "
            + self._q(qname)
            + " RETURN s.id, s.repo_id, s.type, s.name, s.qualified_name, s.file_path, "
            "s.start_line, s.end_line, s.signature, s.docstring, s.code_snippet LIMIT 1"
        )
        rows = self._rows(self.conn.execute(query))
        if not rows:
            return None
        row = rows[0]
        return {
            "id": row[0],
            "repo_id": row[1],
            "type": row[2],
            "name": row[3],
            "qualified_name": row[4],
            "file_path": row[5],
            "start_line": int(row[6]),
            "end_line": int(row[7]),
            "signature": row[8] or "",
            "docstring": row[9] or "",
            "code_snippet": row[10] or "",
        }

    def find_by_name(self, repo_id: str, name: str) -> list[dict[str, Any]]:
        query = (
            "MATCH (s:Symbol) WHERE s.repo_id = "
            + self._q(repo_id)
            + " AND s.name = "
            + self._q(name)
            + " RETURN s.id, s.repo_id, s.type, s.name, s.qualified_name, s.file_path, "
            "s.start_line, s.end_line, s.signature, s.docstring, s.code_snippet"
        )
        rows = self._rows(self.conn.execute(query))
        return [
            {
                "id": row[0],
                "repo_id": row[1],
                "type": row[2],
                "name": row[3],
                "qualified_name": row[4],
                "file_path": row[5],
                "start_line": int(row[6]),
                "end_line": int(row[7]),
                "signature": row[8] or "",
                "docstring": row[9] or "",
                "code_snippet": row[10] or "",
            }
            for row in rows
        ]

    def neighbors(
        self,
        node_id: str,
        edge_types: list[str] | None,
        direction: str,
        depth: int,
        repo_id: str,
    ) -> list[dict[str, Any]]:
        frontier = {node_id}
        visited = {node_id}
        results: dict[str, dict[str, Any]] = {}
        for _ in range(max(depth, 1)):
            next_frontier: set[str] = set()
            for nid in frontier:
                for row in self._one_hop(nid, edge_types=edge_types, direction=direction, repo_id=repo_id):
                    symbol = row["symbol"]
                    edge_type = row["edge_type"]
                    sid = symbol["id"]
                    if sid in visited:
                        continue
                    visited.add(sid)
                    next_frontier.add(sid)
                    if sid not in results:
                        results[sid] = symbol | {"edge_type": edge_type}
            frontier = next_frontier
            if not frontier:
                break
        return list(results.values())

    def callers(self, node_id: str, repo_id: str) -> list[dict[str, Any]]:
        return [row["symbol"] | {"edge_type": row["edge_type"]} for row in self._one_hop(node_id, ["CALLS"], "in", repo_id)]

    def callees(self, node_id: str, repo_id: str) -> list[dict[str, Any]]:
        return [row["symbol"] | {"edge_type": row["edge_type"]} for row in self._one_hop(node_id, ["CALLS"], "out", repo_id)]

    def find_path(self, from_qname: str, to_qname: str, max_hops: int, repo_id: str) -> list[dict[str, Any]]:
        src = self.get_symbol_by_qname(repo_id, from_qname) or self._choose_first_by_name(repo_id, from_qname)
        dst = self.get_symbol_by_qname(repo_id, to_qname) or self._choose_first_by_name(repo_id, to_qname)
        if not src or not dst:
            return []

        if src["id"] == dst["id"]:
            return [src | {"edge": None}]

        queue = deque([[src["id"]]])
        visited = {src["id"]}
        parent_edge: dict[str, tuple[str, str]] = {}
        found = False

        while queue:
            path_ids = queue.popleft()
            current = path_ids[-1]
            if len(path_ids) - 1 >= max_hops:
                continue
            for hop in self._one_hop(current, edge_types=["CALLS"], direction="out", repo_id=repo_id):
                nxt = hop["symbol"]["id"]
                if nxt in visited:
                    continue
                visited.add(nxt)
                parent_edge[nxt] = (current, hop["edge_type"])
                new_path = path_ids + [nxt]
                if nxt == dst["id"]:
                    found = True
                    queue.clear()
                    break
                queue.append(new_path)
            if found:
                break

        if not found:
            return []

        ordered_ids = [dst["id"]]
        while ordered_ids[-1] != src["id"]:
            prev, _etype = parent_edge[ordered_ids[-1]]
            ordered_ids.append(prev)
        ordered_ids.reverse()

        symbol_map = {s["id"]: s for s in self.get_symbols(repo_id)}
        out: list[dict[str, Any]] = []
        for idx, sid in enumerate(ordered_ids):
            edge_label = None
            if idx > 0:
                _prev, edge_label = parent_edge[sid]
            out.append(symbol_map[sid] | {"edge": edge_label})
        return out

    def _choose_first_by_name(self, repo_id: str, maybe_qname_or_name: str) -> dict[str, Any] | None:
        name = maybe_qname_or_name.split(".")[-1]
        rows = self.find_by_name(repo_id, name)
        if not rows:
            return None
        return sorted(rows, key=lambda r: (r["file_path"], r["start_line"]))[0]

    def _one_hop(self, node_id: str, edge_types: list[str] | None, direction: str, repo_id: str) -> list[dict[str, Any]]:
        edge_filter = ""
        if edge_types:
            vals = ", ".join(self._q(v) for v in edge_types)
            edge_filter = f" AND e.type IN [{vals}]"

        if direction == "in":
            query = (
                "MATCH (n:Symbol)-[e:Edge]->(m:Symbol) WHERE m.id = "
                + self._q(node_id)
                + " AND e.repo_id = "
                + self._q(repo_id)
                + edge_filter
                + " RETURN n.id, n.repo_id, n.type, n.name, n.qualified_name, n.file_path, n.start_line, n.end_line,"
                + " n.signature, n.docstring, n.code_snippet, e.type"
            )
        else:
            query = (
                "MATCH (n:Symbol)-[e:Edge]->(m:Symbol) WHERE n.id = "
                + self._q(node_id)
                + " AND e.repo_id = "
                + self._q(repo_id)
                + edge_filter
                + " RETURN m.id, m.repo_id, m.type, m.name, m.qualified_name, m.file_path, m.start_line, m.end_line,"
                + " m.signature, m.docstring, m.code_snippet, e.type"
            )
        rows = self._rows(self.conn.execute(query))
        out: list[dict[str, Any]] = []
        for row in rows:
            out.append(
                {
                    "symbol": {
                        "id": row[0],
                        "repo_id": row[1],
                        "type": row[2],
                        "name": row[3],
                        "qualified_name": row[4],
                        "file_path": row[5],
                        "start_line": int(row[6]),
                        "end_line": int(row[7]),
                        "signature": row[8] or "",
                        "docstring": row[9] or "",
                        "code_snippet": row[10] or "",
                    },
                    "edge_type": row[11] or "",
                }
            )
        return out

    @staticmethod
    def _q(value: str) -> str:
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'

    @staticmethod
    def _single_int(result: Any) -> int:
        for row in KuzuGraphStore._rows(result):
            return int(row[0])
        return 0

    @staticmethod
    def _rows(result: Any) -> list[Any]:
        rows: list[Any] = []
        try:
            while result.has_next():
                rows.append(result.get_next())
            return rows
        except Exception:
            pass
        try:
            return list(result)
        except Exception:
            return rows
