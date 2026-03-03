const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = 3000;

// 允许前端跨域访问 (前端在 5173, 后端在 3000)
app.use(cors());
app.use(express.json());

// --- 1. 配置 AI 客户端 (兼容 Qwen/OpenAI/DeepSeek) ---
// 核心逻辑：虽然库叫 openai，但只要修改 baseURL，就能连任何大模型
const aiClient = new OpenAI({
  apiKey: process.env.AI_API_KEY || "EMPTY", 
  baseURL: process.env.AI_BASE_URL || "http://localhost:8000/v1", 
});

const MODEL_NAME = process.env.AI_MODEL_NAME || "Qwen/Qwen3-VL-235B-A22B-Instruct";

// --- 2. 定义生成题目的接口 ---
app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  console.log(`[Backend] 收到请求，关键词: ${prompt}`);
  console.log(`[Backend] 正在调用模型: ${MODEL_NAME}...`);

  try {
    const completion = await aiClient.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { 
          role: "system", 
          content: `你是一个资深的 C++/全栈技术面试官。
          请根据用户输入的知识点，出一道有深度的面试题，并给出详细的参考答案。
          
          【重要】请务必只返回纯 JSON 格式，不要包含 Markdown 标记（如 \`\`\`json），格式如下：
          {
            "title": "题目名称",
            "content": "详细的答案解析...",
            "category": "技术分类(如C++ / 网络 / OS)",
            "tags": ["标签1", "标签2"]
          }` 
        },
        { 
          role: "user", 
          content: `请针对 "${prompt}" 这个知识点出一道面试题。` 
        }
      ],
      // 如果模型支持 json_object 模式最好，不支持则依赖 Prompt 约束
      response_format: { type: "json_object" }, 
      temperature: 0.7,
    });

    const resultText = completion.choices[0].message.content;
    console.log("[Backend] 模型生成完成，原始结果:", resultText);

    // 尝试解析 JSON，防止模型偶尔返回非 JSON 内容
    let aiData;
    try {
      aiData = JSON.parse(resultText);
    } catch (e) {
      // 容错处理：如果模型没返回 JSON，手动包装一下
      aiData = {
        title: `关于 ${prompt} 的面试题`,
        content: resultText,
        category: "AI生成",
        tags: ["AI"]
      };
    }

    res.json(aiData);

  } catch (error) {
    console.error("[Backend] Error:", error);
    res.status(500).json({ error: "AI 生成失败，请检查后端日志" });
  }
});

app.listen(port, () => {
  console.log(`✅ 后端服务已启动: http://localhost:${port}`);
});