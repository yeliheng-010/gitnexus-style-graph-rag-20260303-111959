from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from tree_sitter import Node
from tree_sitter_language_pack import get_parser

LANG_EXTENSIONS = {
    "python": {".py"},
    "javascript": {".js", ".jsx", ".mjs", ".cjs"},
    "typescript": {".ts", ".tsx"},
}


@dataclass
class SymbolDraft:
    type: str
    name: str
    qualified_name: str
    file_path: str
    start_line: int
    end_line: int
    signature: str = ""
    docstring: str = ""
    code_snippet: str = ""
    repo_id: str = ""
    id: str = ""


@dataclass
class EdgeDraft:
    src_qname: str
    dst_qname: str
    type: str
    repo_id: str
    src_id: str = ""
    dst_id: str = ""


@dataclass
class UnresolvedRelation:
    src_qname: str
    dst_hint: str
    rel_type: str
    repo_id: str
    src_file: str


@dataclass
class ParseResult:
    symbols: list[SymbolDraft] = field(default_factory=list)
    unresolved_relations: list[UnresolvedRelation] = field(default_factory=list)


def supported_language(path: Path, selected_languages: Iterable[str]) -> str | None:
    suffix = path.suffix.lower()
    enabled = set(selected_languages)
    for lang, extensions in LANG_EXTENSIONS.items():
        if lang in enabled and suffix in extensions:
            return lang
    return None


def parse_source_file(repo_id: str, repo_root: Path, file_path: Path, language: str) -> ParseResult:
    source = file_path.read_bytes()
    parser = get_parser(language)
    tree = parser.parse(source)
    rel_file = file_path.relative_to(repo_root).as_posix()
    source_lines = source.decode("utf-8", errors="ignore").splitlines()
    module_qname = rel_file.replace("/", ".")
    for ext in [".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]:
        if module_qname.endswith(ext):
            module_qname = module_qname[: -len(ext)]

    result = ParseResult()
    result.symbols.append(
        SymbolDraft(
            type="module",
            name=Path(module_qname).name or module_qname.split(".")[-1],
            qualified_name=module_qname,
            file_path=rel_file,
            start_line=1,
            end_line=max(1, len(source_lines)),
            code_snippet=_snippet(source_lines, 1, min(len(source_lines), 80)),
            repo_id=repo_id,
        )
    )

    def visit(node: Node, scope: list[str], current_class: str | None = None) -> None:
        if language == "python":
            _visit_python_node(node, scope, current_class, result, module_qname, rel_file, source, source_lines, repo_id)
        else:
            _visit_js_ts_node(node, scope, current_class, result, module_qname, rel_file, source, source_lines, repo_id)
        for child in node.children:
            visit(child, scope, current_class)

    visit(tree.root_node, [module_qname], None)
    return result


def _visit_python_node(
    node: Node,
    scope: list[str],
    current_class: str | None,
    result: ParseResult,
    module_qname: str,
    rel_file: str,
    source: bytes,
    source_lines: list[str],
    repo_id: str,
) -> None:
    if node.type == "class_definition":
        name_node = node.child_by_field_name("name")
        if name_node is None:
            return
        cls_name = _node_text(name_node, source)
        qname = f"{module_qname}.{cls_name}"
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        result.symbols.append(
            SymbolDraft(
                type="class",
                name=cls_name,
                qualified_name=qname,
                file_path=rel_file,
                start_line=start_line,
                end_line=end_line,
                signature=f"class {cls_name}",
                code_snippet=_snippet(source_lines, start_line, end_line),
                repo_id=repo_id,
            )
        )
        result.unresolved_relations.append(
            UnresolvedRelation(src_qname=module_qname, dst_hint=qname, rel_type="OWNS", repo_id=repo_id, src_file=rel_file)
        )
        superclasses = _extract_python_superclasses(node, source)
        for base in superclasses:
            result.unresolved_relations.append(
                UnresolvedRelation(src_qname=qname, dst_hint=base, rel_type="HERITAGE", repo_id=repo_id, src_file=rel_file)
            )

        for child in node.children:
            if child.type == "block":
                for item in child.children:
                    if item.type == "function_definition":
                        _add_python_function(
                            item,
                            module_qname=module_qname,
                            class_qname=qname,
                            rel_file=rel_file,
                            source=source,
                            source_lines=source_lines,
                            repo_id=repo_id,
                            result=result,
                        )
        return

    if node.type == "function_definition":
        if _has_parent_type(node, "class_definition"):
            return
        _add_python_function(
            node,
            module_qname=module_qname,
            class_qname=None,
            rel_file=rel_file,
            source=source,
            source_lines=source_lines,
            repo_id=repo_id,
            result=result,
        )
        return

    if node.type in {"import_statement", "import_from_statement"}:
        imports = _extract_python_imports(node, source)
        for imp in imports:
            result.unresolved_relations.append(
                UnresolvedRelation(src_qname=module_qname, dst_hint=imp, rel_type="IMPORTS", repo_id=repo_id, src_file=rel_file)
            )
        return

    if node.type == "call":
        func = node.child_by_field_name("function")
        if func is None:
            return
        callee = _extract_callable_name(func, source)
        caller = _nearest_python_callable_qname(node, source, module_qname)
        if caller and callee:
            result.unresolved_relations.append(
                UnresolvedRelation(src_qname=caller, dst_hint=callee, rel_type="CALLS", repo_id=repo_id, src_file=rel_file)
            )


def _visit_js_ts_node(
    node: Node,
    scope: list[str],
    current_class: str | None,
    result: ParseResult,
    module_qname: str,
    rel_file: str,
    source: bytes,
    source_lines: list[str],
    repo_id: str,
) -> None:
    if node.type == "class_declaration":
        name_node = node.child_by_field_name("name")
        if name_node is None:
            return
        cls_name = _node_text(name_node, source)
        qname = f"{module_qname}.{cls_name}"
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        result.symbols.append(
            SymbolDraft(
                type="class",
                name=cls_name,
                qualified_name=qname,
                file_path=rel_file,
                start_line=start_line,
                end_line=end_line,
                signature=f"class {cls_name}",
                code_snippet=_snippet(source_lines, start_line, end_line),
                repo_id=repo_id,
            )
        )
        result.unresolved_relations.append(
            UnresolvedRelation(src_qname=module_qname, dst_hint=qname, rel_type="OWNS", repo_id=repo_id, src_file=rel_file)
        )
        heritage = _extract_js_ts_heritage(node, source)
        for base in heritage:
            result.unresolved_relations.append(
                UnresolvedRelation(src_qname=qname, dst_hint=base, rel_type="HERITAGE", repo_id=repo_id, src_file=rel_file)
            )
        return

    if node.type == "function_declaration":
        name_node = node.child_by_field_name("name")
        if name_node is None:
            return
        fn_name = _node_text(name_node, source)
        qname = f"{module_qname}.{fn_name}"
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        result.symbols.append(
            SymbolDraft(
                type="function",
                name=fn_name,
                qualified_name=qname,
                file_path=rel_file,
                start_line=start_line,
                end_line=end_line,
                signature=f"function {fn_name}()",
                code_snippet=_snippet(source_lines, start_line, end_line),
                repo_id=repo_id,
            )
        )
        result.unresolved_relations.append(
            UnresolvedRelation(src_qname=module_qname, dst_hint=qname, rel_type="OWNS", repo_id=repo_id, src_file=rel_file)
        )
        return

    if node.type == "method_definition":
        name_node = node.child_by_field_name("name")
        cls = _nearest_parent_name(node, "class_declaration", source)
        if name_node is None or cls is None:
            return
        fn_name = _node_text(name_node, source)
        cls_qname = f"{module_qname}.{cls}"
        qname = f"{cls_qname}.{fn_name}"
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        result.symbols.append(
            SymbolDraft(
                type="method",
                name=fn_name,
                qualified_name=qname,
                file_path=rel_file,
                start_line=start_line,
                end_line=end_line,
                signature=f"{fn_name}()",
                code_snippet=_snippet(source_lines, start_line, end_line),
                repo_id=repo_id,
            )
        )
        result.unresolved_relations.append(
            UnresolvedRelation(src_qname=cls_qname, dst_hint=qname, rel_type="OWNS", repo_id=repo_id, src_file=rel_file)
        )
        return

    if node.type == "import_statement":
        text = _node_text(node, source)
        # import { process } from "./service";
        if "from" in text:
            frag = text.split("from", 1)[-1].strip().strip(";").strip("\"'")
            if frag:
                result.unresolved_relations.append(
                    UnresolvedRelation(
                        src_qname=module_qname,
                        dst_hint=frag.replace("/", ".").replace("..", ""),
                        rel_type="IMPORTS",
                        repo_id=repo_id,
                        src_file=rel_file,
                    )
                )
        return

    if node.type == "call_expression":
        fn_node = node.child_by_field_name("function")
        callee = _extract_callable_name(fn_node, source) if fn_node else ""
        caller = _nearest_js_ts_callable_qname(node, source, module_qname)
        if caller and callee:
            result.unresolved_relations.append(
                UnresolvedRelation(src_qname=caller, dst_hint=callee, rel_type="CALLS", repo_id=repo_id, src_file=rel_file)
            )


def _add_python_function(
    node: Node,
    module_qname: str,
    class_qname: str | None,
    rel_file: str,
    source: bytes,
    source_lines: list[str],
    repo_id: str,
    result: ParseResult,
) -> None:
    name_node = node.child_by_field_name("name")
    if name_node is None:
        return
    fn_name = _node_text(name_node, source)
    start_line = node.start_point[0] + 1
    end_line = node.end_point[0] + 1
    qname = f"{class_qname}.{fn_name}" if class_qname else f"{module_qname}.{fn_name}"
    typ = "method" if class_qname else "function"
    signature = _build_python_signature(node, source)
    result.symbols.append(
        SymbolDraft(
            type=typ,
            name=fn_name,
            qualified_name=qname,
            file_path=rel_file,
            start_line=start_line,
            end_line=end_line,
            signature=signature,
            docstring=_extract_python_docstring(node, source),
            code_snippet=_snippet(source_lines, start_line, end_line),
            repo_id=repo_id,
        )
    )
    owner = class_qname or module_qname
    result.unresolved_relations.append(
        UnresolvedRelation(src_qname=owner, dst_hint=qname, rel_type="OWNS", repo_id=repo_id, src_file=rel_file)
    )


def _extract_python_imports(node: Node, source: bytes) -> list[str]:
    text = _node_text(node, source)
    out: list[str] = []
    if text.startswith("import "):
        rest = text[len("import ") :]
        out.extend([item.strip().split(" as ")[0] for item in rest.split(",") if item.strip()])
    elif text.startswith("from "):
        pieces = text.split()
        if len(pieces) >= 2:
            out.append(pieces[1])
    return out


def _extract_python_superclasses(node: Node, source: bytes) -> list[str]:
    txt = _node_text(node, source)
    if "(" not in txt or ")" not in txt:
        return []
    middle = txt.split("(", 1)[1].split(")", 1)[0]
    return [item.strip() for item in middle.split(",") if item.strip()]


def _extract_js_ts_heritage(node: Node, source: bytes) -> list[str]:
    txt = _node_text(node, source)
    if "extends" not in txt:
        return []
    tail = txt.split("extends", 1)[1].split("{", 1)[0]
    return [tail.strip().split()[0]] if tail.strip() else []


def _nearest_python_callable_qname(node: Node, source: bytes, module_qname: str) -> str | None:
    cur = node.parent
    cls_name: str | None = None
    while cur is not None:
        if cur.type == "class_definition":
            name_node = cur.child_by_field_name("name")
            if name_node:
                cls_name = _node_text(name_node, source)
        if cur.type == "function_definition":
            fn = cur.child_by_field_name("name")
            if fn is None:
                return None
            fn_name = _node_text(fn, source)
            if cls_name:
                return f"{module_qname}.{cls_name}.{fn_name}"
            return f"{module_qname}.{fn_name}"
        cur = cur.parent
    return module_qname


def _nearest_js_ts_callable_qname(node: Node, source: bytes, module_qname: str) -> str | None:
    cur = node.parent
    cls_name: str | None = None
    while cur is not None:
        if cur.type == "class_declaration":
            n = cur.child_by_field_name("name")
            if n:
                cls_name = _node_text(n, source)
        if cur.type in {"function_declaration", "method_definition"}:
            n = cur.child_by_field_name("name")
            if n is None:
                return None
            fn_name = _node_text(n, source)
            if cls_name:
                return f"{module_qname}.{cls_name}.{fn_name}"
            return f"{module_qname}.{fn_name}"
        cur = cur.parent
    return module_qname


def _nearest_parent_name(node: Node, parent_type: str, source: bytes) -> str | None:
    cur = node.parent
    while cur is not None:
        if cur.type == parent_type:
            name_node = cur.child_by_field_name("name")
            return _node_text(name_node, source) if name_node else None
        cur = cur.parent
    return None


def _extract_callable_name(node: Node, source: bytes) -> str:
    text = _node_text(node, source).strip()
    if not text:
        return ""
    if "." in text:
        return text.split(".")[-1]
    return text


def _build_python_signature(node: Node, source: bytes) -> str:
    name_node = node.child_by_field_name("name")
    params_node = node.child_by_field_name("parameters")
    name = _node_text(name_node, source) if name_node else ""
    params = _node_text(params_node, source) if params_node else "()"
    return f"def {name}{params}"


def _extract_python_docstring(node: Node, source: bytes) -> str:
    for child in node.children:
        if child.type != "block":
            continue
        for stmt in child.children:
            if stmt.type == "expression_statement":
                raw = _node_text(stmt, source).strip()
                if raw.startswith(("'''", '"""', "'", '"')):
                    return raw.strip().strip("'\"")
            break
    return ""


def _has_parent_type(node: Node, parent_type: str) -> bool:
    cur = node.parent
    while cur is not None:
        if cur.type == parent_type:
            return True
        cur = cur.parent
    return False


def _snippet(lines: list[str], start_line: int, end_line: int, max_lines: int = 80) -> str:
    if not lines:
        return ""
    start_idx = max(start_line - 1, 0)
    end_idx = min(end_line, len(lines))
    snippet_lines = lines[start_idx:end_idx]
    if len(snippet_lines) > max_lines:
        snippet_lines = snippet_lines[:max_lines]
    return "\n".join(snippet_lines).strip()


def _node_text(node: Node | None, source: bytes) -> str:
    if node is None:
        return ""
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="ignore")
