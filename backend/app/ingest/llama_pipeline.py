from __future__ import annotations

import json
from pathlib import Path

from llama_index.core import SimpleDirectoryReader
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter


LANGUAGE_EXTS = {
    "python": [".py"],
    "typescript": [".ts", ".tsx"],
    "javascript": [".js", ".jsx", ".mjs", ".cjs"],
}


class LlamaIngestionPipeline:
    def __init__(self, ingest_root: Path) -> None:
        self.ingest_root = ingest_root
        self.ingest_root.mkdir(parents=True, exist_ok=True)

    def run(
        self,
        repo_id: str,
        repo_path: Path,
        include_globs: list[str],
        exclude_globs: list[str],
        languages: list[str],
    ) -> list[dict[str, object]]:
        exts: list[str] = []
        for language in languages:
            exts.extend(LANGUAGE_EXTS.get(language, []))

        reader = SimpleDirectoryReader(
            input_dir=str(repo_path),
            required_exts=exts or None,
            recursive=True,
            exclude=exclude_globs,
            filename_as_id=True,
        )
        docs = reader.load_data()
        for doc in docs:
            file_path = str(doc.metadata.get("file_path", ""))
            rel_path = Path(file_path).relative_to(repo_path).as_posix() if file_path else ""
            doc.metadata["repo_id"] = repo_id
            doc.metadata["file_path"] = rel_path
            doc.metadata["language"] = self._guess_language(rel_path)

        pipeline = IngestionPipeline(
            transformations=[
                SentenceSplitter(chunk_size=700, chunk_overlap=80),
            ]
        )
        nodes = pipeline.run(documents=docs)
        chunks: list[dict[str, object]] = []
        for idx, node in enumerate(nodes):
            chunks.append(
                {
                    "chunk_id": f"{repo_id}-chunk-{idx}",
                    "text": node.text,
                    "metadata": node.metadata,
                }
            )

        output_file = self.ingest_root / f"{repo_id}_chunks.json"
        output_file.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")
        return chunks

    @staticmethod
    def _guess_language(path: str) -> str:
        p = path.lower()
        if p.endswith(".py"):
            return "python"
        if p.endswith((".ts", ".tsx")):
            return "typescript"
        if p.endswith((".js", ".jsx", ".mjs", ".cjs")):
            return "javascript"
        return "unknown"
