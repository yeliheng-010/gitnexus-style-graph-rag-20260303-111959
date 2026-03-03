# GitNexus-Style Agentic GraphRAG（全容器化）

一个面向代码仓库的本地 Agentic GraphRAG 系统。  
核心目标：不是“一次检索一次回答”，而是由 Agent 动态决定是否检索、是否图扩展、是否调用路径工具、是否再次验证重试。

## 1. 核心能力

- 代码解析：`tree-sitter` 抽取 Symbol + Edge（`CALLS/IMPORTS/OWNS/HERITAGE`）
- 图存储：`KuzuDB` 保存符号图并支持邻居扩展与路径搜索
- 向量检索：`Chroma`
- 关键词检索：`BM25`
- 混合检索：`BM25 + Vector + RRF`
- 工作流编排：`LangGraph`（有状态、可循环、可追踪）
- Ingestion：`LlamaIndex`（读取/切分/元数据）
- LLM/Embeddings 封装：`LangChain`
- 前端：React + Vite 黑白极简 UI（Ingest / Chat / Call Path / Trace / Citations / Guide）

## 2. Agent 工作流（重点）

### 2.1 GraphState（状态）

工作流在状态对象中流转，关键字段包括：

- `messages/history`：对话上下文
- `user_message`
- `repo_id`, `session_id`
- `retrieval_mode`：`none|semantic|hybrid`
- `retrieved_symbols`, `expanded_symbols`
- `path_result`, `context_pack`
- `used_retrieval`, `used_graph`, `used_path`
- `citations`, `trace`
- `symbol_candidates`（消歧候选）
- `attempts/max_attempts`（自验证循环）

### 2.2 节点与职责

1. `router`  
   - 识别请求类型：`direct_answer / RAG / GraphRAG / CallPath / NeedDisambiguation`
2. `symbol_suggest_tool`  
   - 前缀补全 + 模糊匹配，处理短名/歧义符号
3. `retrieve_tool`  
   - 语义检索或混合检索，返回初始命中 symbols
4. `expand_graph_tool`  
   - 对命中 symbols 做图扩展（callers/callees/imports/owns）
5. `call_path_tool`  
   - 在 Kuzu 中做最短路径/BFS，生成逐步 citation
6. `answer`  
   - 基于 `context_pack` 生成回答 + citations + trace
7. `verify`  
   - 证据不足则重写查询并提高检索参数后再循环一次（最多 2 次）

### 2.3 Agentic 行为特征

- 不是固定死流程，Agent 会根据问题类型切换路径
- 支持“先消歧 -> 再检索 -> 再扩展 -> 再回答”
- 支持“回答后自检 -> 不足则重试”
- 所有关键步骤写入 `trace`，前端可直接查看节点执行序列

## 3. 项目结构

```text
gitnexus-style-graph-rag/
  backend/
  frontend/
  sample_repo/
  storage/
  mounted_repo/
  docker-compose.yml
  .env.example
  README.md
```

## 4. 环境与启动

仅要求宿主机安装 Docker Desktop（Windows 11）。

1. 启动 Docker Desktop  
2. 复制环境变量：

```bash
cp .env.example .env
```

3. 启动：

```bash
docker compose up --build
```

4. 前端：`http://localhost:5173`  
5. 后端健康检查：`http://localhost:8000/health`

## 5. Windows 挂载示例

宿主机目录：

`C:\Users\叶立恒\Desktop\gitnexus-style-graph-rag\mounted_repo\my_project`

容器目录：

`/repo/my_project`

前端 Ingest 时填写：

`repo_path=/repo/my_project`

注意：在 Docker Desktop 的 File Sharing 中允许该路径共享（中文路径也要显式授权）。

## 6. API 快速示例

### 6.1 Ingest

```bash
curl -X POST http://localhost:8000/ingest ^
  -H "Content-Type: application/json" ^
  -d "{\"repo_path\":\"/app/sample_repo\",\"include_globs\":[\"**/*.*\"],\"exclude_globs\":[\"**/.git/**\",\"**/node_modules/**\",\"**/venv/**\"],\"languages\":[\"python\",\"typescript\",\"javascript\"]}"
```

### 6.2 Symbol Suggest

```bash
curl "http://localhost:8000/symbols/suggest?repo_id=<repo_id>&q=run&mode=fuzzy&top_n=10&session_id=s1"
```

### 6.3 Chat（兼容普通请求）

```bash
curl -X POST http://localhost:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"session_id\":\"s1\",\"repo_id\":\"<repo_id>\",\"message\":\"app.logic.compute_total 做什么？\",\"top_k\":8,\"graph_depth\":2,\"hybrid\":true}"
```

### 6.4 Chat Streaming（SSE）

```bash
curl -N -X POST http://localhost:8000/chat/stream ^
  -H "Content-Type: application/json" ^
  -d "{\"session_id\":\"s1\",\"repo_id\":\"<repo_id>\",\"message\":\"解释 app.service.handle_request\",\"top_k\":8,\"graph_depth\":2,\"hybrid\":true}"
```

### 6.5 Call Path

```bash
curl -X POST http://localhost:8000/path ^
  -H "Content-Type: application/json" ^
  -d "{\"repo_id\":\"<repo_id>\",\"from_symbol\":\"app.entry.run_app\",\"to_symbol\":\"app.repo.save_order\",\"max_hops\":10,\"session_id\":\"s1\"}"
```

## 7. 前端功能

- 仓库索引：路径输入、索引状态、统计信息
- 对话：SSE 流式显示，失败自动回退普通 `/chat`
- 调用路径：from/to 自动补全（prefix + fuzzy）
- 引用：逐条展开代码片段并复制
- 执行轨迹：route / attempts / 节点调用链 / 原始 trace
- 使用指南：内置操作步骤与排障命令

## 8. 测试（容器内）

```bash
docker compose run --rm backend pytest
```

覆盖点：

1. 图构建与调用路径可达
2. Suggest（prefix/fuzzy + 排序）
3. Ingest 持久化（kuzu/chroma/bm25）
4. API（`/chat` 与 `/path` 返回结构）

## 9. 无 Key 运行策略

- 若未设置可用 API Key，服务仍可启动
- 自动切换到 `FakeLLM + DummyEmbeddings`
- 便于本地开发与离线测试

## 10. 常见问题

- 未索引就对话：先执行 Ingest，确认状态为“已索引”
- 路径查不到：先用 `/symbols/suggest` 消歧后再查路径
- 后端报错：`docker compose logs -f backend`
- 挂载失败：检查 compose volume 与 Docker Desktop File Sharing

