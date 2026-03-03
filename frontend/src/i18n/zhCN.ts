export type GuideSection = {
  id: string;
  title: string;
  description?: string;
  steps?: string[];
  commands?: Array<{ label: string; value: string }>;
  notes?: string[];
};

export const zhCN = {
  app: {
    mobileTabs: {
      chat: "对话",
      path: "调用路径",
      trace: "执行轨迹",
      citations: "引用",
      guide: "指南"
    },
    drawer: {
      title: "使用指南",
      subtitle: "Windows + Docker 下快速使用 GitNexus 风格 GraphRAG"
    },
    toast: {
      ingestSuccessTitle: "索引成功",
      ingestSuccessMessage: "{symbols} 个符号 / {edges} 条关系",
      ingestFailedTitle: "索引失败",
      ingestFailedMessage: "索引失败：{error}",
      ingestRequiredTitle: "请先完成索引",
      candidateSelectedTitle: "已选择候选符号",
      chatFailedTitle: "对话请求失败",
      chatFailedMessage: "请求失败：{error}",
      pathSuccessTitle: "路径查找完成",
      pathSuccessMessage: "{steps} 步",
      pathNotFoundTitle: "未找到路径",
      pathFailedTitle: "调用路径请求失败",
      pathFailedMessage: "调用路径请求失败：{error}",
      copySuccessTitle: "已复制",
      copySuccessMessage: "内容已复制到剪贴板",
      copyFailedTitle: "复制失败",
      copyFailedMessage: "无法访问剪贴板，请手动复制"
    }
  },
  header: {
    title: "GitNexus GraphRAG",
    subtitle: "GitNexus 风格 Agentic GraphRAG · LlamaIndex + LangChain + LangGraph + Kuzu + Chroma",
    indexed: "已索引",
    notIndexed: "未索引",
    repoId: "仓库ID",
    symbols: "符号数",
    edges: "关系数",
    last: "最近索引",
    helpGuide: "使用指南",
    themeLabel: "主题：{theme}",
    light: "浅色",
    dark: "深色"
  },
  sidebar: {
    title: "仓库 / 索引",
    subtitle: "挂载仓库到 /repo 后填写容器内路径",
    mountTip:
      "Windows 示例：C:\\Users\\叶立恒\\Desktop\\mounted_repo\\my_project 映射后填写 /repo/my_project",
    repoPathHint: "仓库路径支持 /repo/my_project 或 /app/sample_repo",
    repoPathLabel: "仓库路径",
    repoPathPlaceholder: "/repo/my_project",
    ingesting: "索引中...",
    ingest: "开始索引",
    repoId: "仓库ID",
    retrievalTitle: "检索参数",
    retrievalSubtitle: "这些参数会同时影响对话与调用路径",
    topK: "Top K（返回数量）",
    graphDepth: "图扩展深度",
    maxHops: "最大跳数",
    hybridSearch: "混合检索",
    hybridHint: "启用 BM25 + 向量 + RRF 融合",
    lastIngestTitle: "最近一次索引",
    lastIngestSubtitle: "最近一次索引统计",
    statSymbols: "符号数",
    statEdges: "关系数",
    statDuration: "耗时",
    statLastTime: "索引时间",
    noIngest: "尚未完成索引。"
  },
  chat: {
    title: "对话",
    subtitle: "Agentic GraphRAG 代码问答",
    ready: "可用",
    ingestRequired: "需要先索引",
    emptyTitle: "尚未索引仓库",
    emptyDescription: "请先在左侧执行索引，再开始对话。",
    goIngest: "去索引",
    introExamples: "示例：\"app.logic.compute_total 做什么？\" 或 \"谁调用了 app.repo.save_order？\"",
    roleUser: "你",
    roleAssistant: "助手",
    avatarAssistant: "助",
    avatarUser: "我",
    generating: "正在生成...",
    citationsTitle: "引用（{count}）",
    disambiguationPrompt: "检测到符号歧义，请选择一个候选后继续：",
    inputPlaceholder: "询问仓库代码，例如：xxx 函数做什么？",
    send: "发送",
    sending: "生成中"
  },
  path: {
    title: "调用路径",
    subtitle: "从起点符号到终点符号的最短调用链",
    ready: "图已就绪",
    ingestRequired: "需要先索引",
    emptyTitle: "尚未索引仓库",
    emptyDescription: "请先完成索引，再进行调用路径搜索。",
    fromSymbol: "起点符号",
    toSymbol: "终点符号",
    fromPlaceholder: "app.entry.run_app",
    toPlaceholder: "app.repo.save_order",
    maxHops: "最大跳数",
    searching: "查询中...",
    findPath: "查找路径",
    disambiguationHint: "存在符号歧义，请先选择候选 qualified_name：",
    fromCandidates: "起点候选",
    toCandidates: "终点候选",
    viewSnippet: "查看代码片段",
    step: "步骤 {index}",
    emptySnippet: "（空片段）"
  },
  trace: {
    title: "执行轨迹",
    subtitle: "LangGraph 节点流转与调试信息",
    emptyTitle: "暂无执行轨迹",
    emptyDescription: "请先发起一次对话或调用路径请求。",
    route: "路由",
    attempts: "尝试次数",
    retrievalMode: "检索模式",
    disambiguation: "消歧状态",
    disambiguationNeedsChoice: "需要用户选择",
    disambiguationResolved: "已消歧 / 无需消歧",
    executedNodes: "执行节点",
    nodesEmpty: "节点列表为空。",
    rawJson: "原始轨迹 JSON",
    rawJsonFile: "轨迹数据"
  },
  citations: {
    title: "引用",
    subtitle: "可展开引用片段并复制",
    emptyTitle: "暂无引用",
    emptyDescription: "等待对话或调用路径返回引用结果。"
  },
  guide: {
    tab: "指南",
    copyTitle: "复制标题",
    sections: [
      {
        id: "quick-start",
        title: "1 分钟快速开始",
        description: "先启动 Docker Desktop，然后在项目根目录执行一条命令。",
        commands: [{ label: "启动前后端", value: "docker compose up --build" }],
        notes: ["首次构建会拉取镜像和依赖，耗时较长属于正常现象。"]
      },
      {
        id: "mount-repo",
        title: "挂载本地仓库到容器",
        steps: [
          "将你的代码仓库放到宿主机目录，例如 C:\\Users\\叶立恒\\Desktop\\mounted_repo\\my_project",
          "在 docker-compose.yml 中将 ./mounted_repo 映射到容器 /repo",
          "在页面中将仓库路径填写为 /repo/my_project"
        ],
        notes: ["Windows 需要在 Docker Desktop 的 Settings > Resources > File Sharing 中允许该目录共享。"]
      },
      {
        id: "ingest",
        title: "执行索引",
        steps: [
          "在“仓库 / 索引”面板输入仓库路径",
          "点击“开始索引”，等待状态变为“已索引”",
          "确认符号数 / 关系数大于 0"
        ]
      },
      {
        id: "chat",
        title: "对话示例",
        steps: [
          "某函数做什么：\"app.logic.compute_total 做什么？\"",
          "找调用者：\"谁调用了 app.service.handle_request？\"",
          "定位模块：\"订单保存逻辑在哪个模块？\""
        ]
      },
      {
        id: "call-path",
        title: "调用路径示例",
        steps: [
          "起点/终点输入框支持自动补全和模糊匹配",
          "优先选择候选中的 qualified_name",
          "点击“查找路径”查看调用链和每一步引用"
        ]
      },
      {
        id: "citations-trace",
        title: "如何查看引用与执行轨迹",
        steps: [
          "引用：展开引用片段，按 source:lines 定位到代码",
          "执行轨迹：查看 route、attempts、工具节点（retrieve/expand/path）",
          "证据不足时回答会明确提示不确定/缺少资料"
        ]
      },
      {
        id: "troubleshooting",
        title: "常见错误排查",
        steps: [
          "未设置 OPENAI_API_KEY / DASHSCOPE_API_KEY：服务会退化到 Fake 模式",
          "仓库挂载失败：检查 Docker Desktop 文件共享与 compose volumes",
          "未索引就对话/查路径：先完成索引并确认状态为“已索引”",
          "后端 500：在容器日志中检查错误信息"
        ],
        commands: [
          { label: "查看后端日志", value: "docker compose logs -f backend" },
          { label: "容器内执行测试", value: "docker compose run --rm backend pytest" }
        ]
      }
    ] as GuideSection[]
  },
  codeBlock: {
    defaultTitle: "代码片段",
    collapse: "收起",
    expand: "展开",
    copy: "复制"
  },
  drawer: {
    close: "关闭"
  },
  autocomplete: {
    suggesting: "正在联想...",
    score: "得分 {score}"
  },
  tabs: {
    ariaLabel: "标签页"
  },
  common: {
    requestFailed: "请求失败，请检查后端服务、API Key 或仓库挂载。"
  }
} as const;
