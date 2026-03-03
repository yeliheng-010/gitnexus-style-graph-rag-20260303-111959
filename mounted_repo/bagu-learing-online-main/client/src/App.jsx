import React, { useState, useEffect } from 'react';
import { 
  BookOpen, CheckCircle, XCircle, Filter, RefreshCw, 
  Database, Server, Cpu, LogOut, User, BrainCircuit, 
  Lock, Zap, Trash2, Search, Menu, X, Download, Code, Terminal, 
  Plus, PenTool, Layers, PlayCircle, Eye, EyeOff, ArrowRight, Dice5,
  Moon, Sun
} from 'lucide-react';
import ReactMarkdown from 'react-markdown'; 
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, updateProfile 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, query, serverTimestamp, addDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';

// --- 1. 随机出题范围 ---
const RANDOM_TOPICS = [
  "C++ 基础与进阶", "数据库 (MySQL/Redis)", "数据结构与算法", 
  "计算机网络 (TCP/HTTP)", "操作系统 (Linux)", "C++ 实际开发场景题", "Redis 缓存原理"
];

// --- 2. 预设题库数据 (内联详细版，确保格式漂亮) ---
const PRESET_QUESTIONS = [
    {
      category: "C++",
      title: "C++ 中 const 和 #define 的区别？",
      content: `
### 1. 编译器处理不同
- **#define**：在**预处理阶段**展开。它只是简单的文本替换，没有类型检查。
- **const**：在**编译、运行阶段**使用。它有具体的类型，编译器会进行类型检查。

### 2. 存储方式
- **#define**：不分配内存（宏替换），仅仅是代码展开。
- **const**：变量会在**静态存储区**或**栈**中分配内存。

### 3. 调试体验
- **#define**：难以调试（因为在预处理阶段就被替换了，符号表中没有它）。
- **const**：可以直接调试，能看到变量名和值。
      `,
      tags: ["基础", "编译原理"]
    },
    {
      category: "计算机网络",
      title: "TCP 和 UDP 的区别？",
      content: `
| 特性 | TCP | UDP |
| :--- | :--- | :--- |
| **连接性** | 面向连接 | 无连接 |
| **可靠性** | 可靠 (重传/排序/流控) | 不可靠 (丢包不重传) |
| **传输效率** | 慢 (首部开销 20 字节) | 快 (首部开销 8 字节) |
| **适用场景** | 文件传输、邮件、网页 | 视频会议、直播、DNS |

> **总结**：TCP 就像打电话，必须先接通；UDP 就像寄明信片，寄出去就不管了。
      `,
      tags: ["网络协议", "TCP/UDP"]
    }
];

const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAeJzhGispl90rpFHrpfM0geZpXA6ayu-o",
  authDomain: "mybagu-d41fb.firebaseapp.com",
  projectId: "mybagu-d41fb",
  storageBucket: "mybagu-d41fb.firebasestorage.app",
  messagingSenderId: "1098641694900",
  appId: "1:1098641694900:web:3a773a810aeeaaa8e777e1",
  measurementId: "G-LDNZC6RB0E"
};

// --- 全局样式 (合并了 按钮深色修复 + Markdown格式修复) ---
const GlobalStyle = () => (
  <style>{`
    :root { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }
    
    /* 默认亮色 */
    body { background-color: #f8fafc; color: #0f172a; transition: all 0.3s ease; }

    /* --- 🌙 深色模式强制覆盖 (背景纯黑) --- */
    body.dark { 
      background-color: #000000 !important; 
      color: #e4e4e7 !important; 
    }

    /* 侧边栏 & 顶部栏 */
    body.dark aside, body.dark header {
      background-color: #111111 !important;
      border-color: #27272a !important;
    }

    /* --- 🔴 按钮深色修复 (找回丢失的代码) --- */
    
    /* 1. 侧边栏普通按钮 */
    body.dark .sidebar-btn-normal { 
      background-color: transparent !important;
      color: #a1a1aa !important; 
    }
    body.dark .sidebar-btn-normal:hover { 
      background-color: #27272a !important; 
      color: #ffffff !important; 
    }

    /* 2. 侧边栏选中状态 (深蓝/深橙/深绿) */
    body.dark .sidebar-btn-active-blue {
      background-color: #172554 !important; /* blue-950 */
      color: #60a5fa !important;
      border: 1px solid #1e3a8a !important;
    }
    body.dark .sidebar-btn-active-orange {
      background-color: #431407 !important; /* orange-950 */
      color: #fb923c !important;
      border: 1px solid #7c2d12 !important;
    }
    body.dark .sidebar-btn-active-green {
      background-color: #064e3b !important; /* green-950 */
      color: #4ade80 !important;
      border: 1px solid #14532d !important;
    }

    /* 3. 导入按钮 */
    body.dark .btn-import { 
      background-color: #18181b !important; 
      border: 1px solid #27272a !important; 
      color: #a1a1aa !important; 
    }
    body.dark .btn-import:hover { 
      background-color: #27272a !important; 
      color: #ffffff !important; 
    }

    /* 4. 卡片操作按钮 (查看/复习/掌握) */
    body.dark .btn-show-answer {
      background-color: #1d4ed8 !important; /* blue-700 */
      color: white !important;
      border: none !important;
    }
    body.dark .btn-review {
      background-color: #431407 !important;
      color: #fdba74 !important;
      border: 1px solid #9a3412 !important;
    }
    body.dark .btn-mastered {
      background-color: #064e3b !important;
      color: #86efac !important;
      border: 1px solid #166534 !important;
    }

    /* 5. 输入框 & 弹窗 */
    body.dark input, body.dark textarea, body.dark select {
      background-color: #27272a !important;
      color: #ffffff !important;
      border-color: #3f3f46 !important;
    }
    body.dark input::placeholder { color: #71717a !important; }
    body.dark .modal-content { background-color: #18181b !important; border: 1px solid #27272a !important; }

    /* 卡片样式 */
    body.dark .card-container {
      background-color: #18181b !important;
      border-color: #27272a !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
    }
    body.dark .card-title { color: #ffffff !important; }
    body.dark .card-tag { 
      background-color: #27272a !important; 
      color: #d4d4d8 !important;
      border-color: #3f3f46 !important;
    }

    /* --- ✅ Markdown 样式增强 (保留修复) --- */
    .markdown-body { font-size: 0.95rem; line-height: 1.8; }
    
    /* 列表修复 */
    .markdown-body ul { list-style-type: disc !important; padding-left: 1.5em !important; margin-bottom: 1em; }
    .markdown-body ol { list-style-type: decimal !important; padding-left: 1.5em !important; margin-bottom: 1em; }
    .markdown-body li { margin-bottom: 0.25em; }
    
    /* 表格修复 */
    .markdown-body table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    .markdown-body th, .markdown-body td { border: 1px solid #e2e8f0; padding: 0.5em; }
    body.dark .markdown-body th, body.dark .markdown-body td { border-color: #3f3f46; }
    
    .markdown-body blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; color: #6b7280; font-style: italic; }

    /* 浅色模式 Markdown */
    .markdown-body { color: #334155; }
    .markdown-body pre { background: #1e293b; color: #e2e8f0; padding: 1em; border-radius: 0.5em; overflow-x: auto; }
    .markdown-body code { font-family: monospace; font-size: 0.9em; color: #ef4444; background-color: #f3f4f6; padding: 0.2em 0.4em; border-radius: 0.25em; }
    .markdown-body strong { font-weight: 700; color: #0f172a; }

    /* 深色模式 Markdown */
    body.dark .markdown-body { 
      background-color: #09090b !important;
      color: #e4e4e7 !important; 
      border-color: #27272a !important;
    }
    body.dark .markdown-body code { 
      background-color: #27272a !important; 
      color: #fca5a5 !important; 
      border: 1px solid #3f3f46;
    }
    body.dark .markdown-body pre { background: #09090b; border: 1px solid #27272a; }
    body.dark .markdown-body strong { color: #ffffff !important; }
    body.dark .markdown-body blockquote { border-left-color: #3f3f46; color: #a1a1aa; }
  `}</style>
);

let app, auth, db, isConfigured = false;
try {
  if (YOUR_FIREBASE_CONFIG.apiKey) {
    app = initializeApp(YOUR_FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    isConfigured = true;
  }
} catch (e) { console.error(e); }
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 登录页 ---
const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid), { email, createdAt: serverTimestamp() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.code === 'auth/email-already-in-use' ? "邮箱已注册" : "验证失败，请检查邮箱或密码");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 dark:bg-black p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-8 card-container">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4 ring-4 ring-blue-50 dark:ring-transparent">
            <BrainCircuit size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{isRegister ? '创建账号' : '欢迎回来'}</h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-2">开启你的八股文刷题之旅</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-5">
          {isRegister && (
            <div>
              <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300 mb-1 block">昵称</label>
              <input className="w-full px-4 py-3 border rounded-lg outline-none" required value={name} onChange={e=>setName(e.target.value)} placeholder="如何称呼你？" />
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300 mb-1 block">邮箱</label>
            <input className="w-full px-4 py-3 border rounded-lg outline-none" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300 mb-1 block">密码</label>
            <input className="w-full px-4 py-3 border rounded-lg outline-none" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <div className="text-red-500 text-sm flex items-center gap-2"><Trash2 size={14}/> {error}</div>}
          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700 text-white py-3.5 rounded-lg font-bold shadow-lg transition-all disabled:opacity-70">{loading ? '处理中...' : (isRegister ? '注册' : '登录')}</button>
        </form>
        <div className="mt-6 text-center pt-6 border-t border-slate-100 dark:border-zinc-800">
          <button onClick={() => setIsRegister(!isRegister)} className="text-blue-600 dark:text-blue-400 text-sm hover:underline font-medium">
            {isRegister ? '已有账号？直接登录' : '还没有账号？免费注册'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 主应用 ---
export default function InterviewAppV2() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [viewMode, setViewMode] = useState('list');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualData, setManualData] = useState({ title: '', content: '', category: 'C++', tags: '' });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (darkMode) {
      root.classList.add('dark');
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    return onAuthStateChanged(auth, (u) => { setUser(u); if(!u) setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const qRef = collection(db, 'artifacts', appId, 'users', user.uid, 'questions');
    return onSnapshot(query(qRef), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setQuestions(list);
      setLoading(false);
    });
  }, [user]);

  const deleteQuestion = async (id) => {
    if(!window.confirm("确定删除？")) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'questions', id)); } catch(e) { alert("删除失败"); }
  };
  const handleCardAction = async (id, status) => {
    try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'questions', id), { status }, { merge: true }); } catch(e) {}
    if (viewMode === 'card') {
      setShowAnswer(false);
      if (currentCardIndex < filteredList.length - 1) setCurrentCardIndex(p => p + 1);
      else { alert("刷完了！"); setViewMode('list'); }
    }
  };
  const handleGenerate = async (promptText) => {
    const p = promptText || aiPrompt;
    if (!p.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: p }) });
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'questions'), { ...data, status: 'unseen', createdAt: serverTimestamp() });
      setAiModalOpen(false); setAiPrompt('');
      if(promptText) alert("AI 已生成题目！");
    } catch (e) { alert("生成失败"); } finally { setAiLoading(false); }
  };
  const handleRandomQuestion = () => {
    const topic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
    handleGenerate(`请出关于"${topic}"的面试题`);
  };
  const handleManualSubmit = async () => {
    if (!manualData.title.trim()) return;
    setManualSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'questions'), {
        ...manualData, tags: manualData.tags.split(' '), status: 'unseen', createdAt: serverTimestamp()
      });
      setManualModalOpen(false); setManualData({ title: '', content: '', category: 'C++', tags: '' });
    } catch(e) { alert("保存失败"); } finally { setManualSubmitting(false); }
  };
  const handleImport = async () => {
    if(!window.confirm("导入预设题目？")) return;
    setImporting(true);
    try {
      const batch = writeBatch(db);
      PRESET_QUESTIONS.forEach(q => batch.set(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'questions')), { ...q, status: 'unseen', createdAt: serverTimestamp() }));
      await batch.commit();
      alert("导入成功");
    } catch(e) { alert("失败"); } finally { setImporting(false); }
  };

  const filteredList = questions.filter(q => {
    const s = search.toLowerCase();
    return (q.title.toLowerCase().includes(s) || q.content.toLowerCase().includes(s)) && (filter === 'all' ? true : (filter === 'mastered' ? q.status === 'mastered' : q.status !== 'mastered'));
  });
  const stats = {
    total: questions.length,
    mastered: questions.filter(q => q.status === 'mastered').length,
    review: questions.filter(q => q.status !== 'mastered').length
  };
  const currentCardQuestion = filteredList[currentCardIndex];

  // --- 辅助函数：Markdown 预处理 (关键修复) ---
  const formatMarkdown = (content) => {
    if (!content) return "";
    // 1. 修复单个换行 (在非空行后加两个空格)
    // 2. 修复无空格的列表项 (如 "-item" 改为 "- item")
    return content
      .replace(/([^\n])\n(?!\n)/g, '$1  \n')
      .replace(/^(\s*[-*+])([^\s])/gm, '$1 $2'); 
  };

  if (!isConfigured) return <div className="flex h-screen items-center justify-center bg-black text-white">配置错误</div>;
  if (!user) return loading ? <div className="flex h-screen items-center justify-center bg-black text-white">加载中...</div> : <AuthPage />;

  return (
    <>
      <GlobalStyle />
      <div className="flex h-full min-h-screen">
        
        {sidebarOpen && <div className="fixed inset-0 bg-black/80 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

        <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xl"><BrainCircuit size={28} /><span>八股助手</span></div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400"><X size={24}/></button>
          </div>

          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            <div className="mb-6">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">筛选</div>
              {[
                { id: 'all', icon: Database, label: '全部', count: stats.total, color: 'blue' },
                { id: 'review', icon: RefreshCw, label: '待复习', count: stats.review, color: 'orange' },
                { id: 'mastered', icon: CheckCircle, label: '已掌握', count: stats.mastered, color: 'green' }
              ].map(item => (
                <button key={item.id} onClick={() => {setFilter(item.id); setCurrentCardIndex(0); setSidebarOpen(false)}} 
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    filter===item.id 
                    ? `sidebar-btn-active-${item.color}` 
                    : 'sidebar-btn-normal' 
                  }`}>
                  <item.icon size={18}/> {item.label} 
                  <span className={`ml-auto py-0.5 px-2 rounded text-xs ${filter===item.id ? `bg-${item.color}-100 dark:bg-${item.color}-950` : 'bg-slate-100 dark:bg-zinc-800'}`}>{item.count}</span>
                </button>
              ))}
            </div>
            <div className="mt-auto">
              <button onClick={handleImport} disabled={importing} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors btn-import">
                {importing ? <RefreshCw className="animate-spin" size={18}/> : <Download size={18}/>} 导入预设题库
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{user.email[0].toUpperCase()}</div>
              <div className="truncate text-sm font-medium flex-1">{user.displayName||'用户'}</div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors sidebar-btn-normal">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
            <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm transition sidebar-btn-normal"><LogOut size={16}/> 退出</button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3 md:hidden">
              <button onClick={() => setSidebarOpen(true)} className="text-slate-500"><Menu size={24}/></button>
              <span className="font-bold text-blue-700">八股助手</span>
            </div>
            
            <div className="flex-1 max-w-xl mx-4 hidden md:block relative">
              {viewMode === 'list' && (
                <>
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="搜索题目..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </>
              )}
            </div>

            <div className="flex gap-2 items-center">
               <button onClick={() => setDarkMode(!darkMode)} className="md:hidden p-2 text-slate-500">
                 {darkMode ? <Sun size={20} /> : <Moon size={20} />}
               </button>

               {filteredList.length > 0 && (
                 <button 
                   onClick={() => { setViewMode(viewMode === 'list' ? 'card' : 'list'); setCurrentCardIndex(0); setShowAnswer(false); }}
                   className={`px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 font-bold transition text-sm ${viewMode === 'list' ? 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'}`}
                 >
                   {viewMode === 'list' ? <><PlayCircle size={16}/> 刷题</> : <><Layers size={16}/> 列表</>}
                 </button>
               )}

               <button onClick={handleRandomQuestion} disabled={aiLoading} className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-800 dark:hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 font-medium transition text-sm">
                 {aiLoading ? <RefreshCw className="animate-spin" size={16} /> : <Dice5 size={16} />} <span className="hidden lg:inline">随机</span>
               </button>

               <button onClick={() => setManualModalOpen(true)} className="bg-green-600 hover:bg-green-700 dark:bg-green-800 dark:hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 font-medium transition text-sm">
                 <PenTool size={16} /> <span className="hidden md:inline">录入</span>
               </button>
               
               <button onClick={() => setAiModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 font-medium transition text-sm">
                 <Zap size={16} /> <span className="hidden md:inline">AI</span>
               </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {viewMode === 'list' ? (
              <div className="max-w-4xl mx-auto space-y-6 pb-20">
                {filteredList.map((q) => (
                  <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition hover:shadow-md group relative card-container">
                    <button onClick={() => deleteQuestion(q.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18} /></button>
                    <div className="flex items-center gap-2 mb-3 text-xs font-medium text-slate-500">
                      <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1 border border-slate-200 card-tag">{q.category==='C++'?<Code size={12}/>:<Terminal size={12}/>} {q.category}</span>
                      {q.status === 'mastered' && <span className="text-green-600 flex items-center gap-1"><CheckCircle size={12}/> 已掌握</span>}
                      {q.status === 'review' && <span className="text-orange-600 flex items-center gap-1"><RefreshCw size={12}/> 需复习</span>}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-4 pr-8 card-title">{q.title}</h3>
                    <div className="markdown-body text-sm text-slate-700 bg-slate-50 p-5 rounded-lg border border-slate-100"><ReactMarkdown>{formatMarkdown(q.content)}</ReactMarkdown></div>
                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                      <button onClick={() => handleCardAction(q.id, 'review')} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-orange-50 hover:text-orange-600 rounded-md transition btn-review">有点忘了</button>
                      <button onClick={() => handleCardAction(q.id, 'mastered')} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-green-50 hover:text-green-600 rounded-md transition btn-mastered">完全掌握</button>
                    </div>
                  </div>
                ))}
                {filteredList.length === 0 && <div className="text-center py-20 text-slate-400">空空如也...</div>}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto h-full flex flex-col justify-center pb-20">
                {currentCardQuestion ? (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col min-h-[60vh] card-container">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                          <span>题目 {currentCardIndex + 1} / {filteredList.length}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span>{currentCardQuestion.category}</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight card-title">{currentCardQuestion.title}</h2>
                      </div>
                    </div>
                    <div className="flex-1 p-6 md:p-10 overflow-y-auto relative">
                      {!showAnswer ? (
                        <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-400 z-10 cursor-pointer hover:bg-slate-50 transition" onClick={() => setShowAnswer(true)}>
                           <EyeOff size={48} className="mb-4 text-slate-300"/>
                           <p className="text-lg font-medium">思考一下，点击查看答案</p>
                        </div>
                      ) : (
                        <div className="markdown-body text-base text-slate-700 animate-in fade-in duration-300"><ReactMarkdown>{formatMarkdown(currentCardQuestion.content)}</ReactMarkdown></div>
                      )}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
                      {!showAnswer ? (
                        <button onClick={() => setShowAnswer(true)} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-md flex items-center justify-center gap-2 btn-show-answer"><Eye size={20}/> 查看答案</button>
                      ) : (
                        <>
                          <button onClick={() => handleCardAction(currentCardQuestion.id, 'review')} className="flex-1 py-4 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold text-lg flex items-center justify-center gap-2 btn-review"><RefreshCw size={20}/> 有点忘了</button>
                          <button onClick={() => handleCardAction(currentCardQuestion.id, 'mastered')} className="flex-1 py-4 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 font-bold text-lg flex items-center justify-center gap-2 btn-mastered"><CheckCircle size={20}/> 完全掌握</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                   <div className="text-center py-20">
                     <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40}/></div>
                     <h2 className="text-2xl font-bold text-slate-800 mb-2 card-title">太棒了！</h2>
                     <p className="text-slate-500 mb-8">当前列表题目已全部刷完。</p>
                     <button onClick={() => {setViewMode('list'); setFilter('all');}} className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition">回到题库</button>
                   </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ... 保持弹窗代码不变 ... */}
        {aiModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 modal-content rounded-xl shadow-2xl bg-white">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 card-title text-slate-800"><Zap className="text-blue-600"/> AI 极速出题</h3>
              <input className="w-full border border-slate-300 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="输入知识点..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} autoFocus onKeyDown={e => e.key==='Enter' && handleGenerate()}/>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAiModalOpen(false)} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100">取消</button>
                <button onClick={() => handleGenerate()} disabled={!aiPrompt.trim() || aiLoading} className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-2 font-medium">{aiLoading && <RefreshCw className="animate-spin" size={16}/>} 生成</button>
              </div>
            </div>
          </div>
        )}

        {manualModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] modal-content rounded-xl shadow-2xl bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 card-title"><PenTool className="text-green-600"/> 手动录入</h3>
                <button onClick={() => setManualModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div><label className="block text-sm font-medium text-slate-700 mb-1 card-title">标题</label><input className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none" value={manualData.title} onChange={e => setManualData({...manualData, title: e.target.value})}/></div>
                <div className="flex gap-4">
                  <div className="flex-1"><label className="block text-sm font-medium text-slate-700 mb-1 card-title">分类</label><select className="w-full border border-slate-300 rounded-lg px-4 py-2" value={manualData.category} onChange={e => setManualData({...manualData, category: e.target.value})}><option>C++</option><option>计算机网络</option><option>操作系统</option><option>数据结构</option><option>数据库</option><option>其他</option></select></div>
                  <div className="flex-1"><label className="block text-sm font-medium text-slate-700 mb-1 card-title">标签</label><input className="w-full border border-slate-300 rounded-lg px-4 py-2" placeholder="空格分隔" value={manualData.tags} onChange={e => setManualData({...manualData, tags: e.target.value})}/></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1 card-title">答案 (Markdown)</label><textarea className="w-full border border-slate-300 rounded-lg px-4 py-3 h-48 font-mono text-sm" value={manualData.content} onChange={e => setManualData({...manualData, content: e.target.value})}/></div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setManualModalOpen(false)} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100">取消</button>
                <button onClick={handleManualSubmit} disabled={manualSubmitting} className="px-6 py-2 rounded bg-green-600 hover:bg-green-700 dark:bg-green-800 dark:hover:bg-green-700 text-white disabled:opacity-50 flex items-center gap-2 font-medium">{manualSubmitting ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle size={16}/>} 保存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}