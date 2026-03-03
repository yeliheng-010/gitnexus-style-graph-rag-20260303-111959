export const PRESET_QUESTIONS = [
    {
      category: "C++",
      title: "C++ 中 const 和 #define 的区别？",
      content: "1. 编译器处理不同：#define 是预处理阶段展开（简单的文本替换），没有类型检查；const 是编译运行阶段使用，有类型检查。\n2. 存储方式：#define 不分配内存（宏替换）；const 变量在静态存储区或栈中分配内存。\n3. 调试：#define 难以调试；const 可以调试。",
      tags: ["基础", "编译原理"]
    },
    {
      category: "C++",
      title: "详细解释 C++ 内存分区 (堆、栈、全局区...)",
      content: "1. 栈区 (Stack)：由编译器自动分配释放，存放函数参数值、局部变量等。\n2. 堆区 (Heap)：由程序员分配释放 (new/delete)，若不释放则程序结束时由 OS 回收。\n3. 全局/静态区 (Static)：全局变量和静态变量的存储是放在一块的。\n4. 常量区：存放常量字符串，程序结束释放。\n5. 代码区：存放函数体的二进制代码。",
      tags: ["内存管理", "基础"]
    },
    {
      category: "计算机网络",
      title: "TCP 和 UDP 的区别？",
      content: "1. 连接：TCP 是面向连接的；UDP 是无连接的。\n2. 可靠性：TCP 提供可靠交付 (通过确认、重传、排序)；UDP 不保证可靠性。\n3. 速度：TCP 慢，开销大；UDP 快，开销小。\n4. 场景：TCP 适合文件传输、邮件；UDP 适合视频会议、直播。",
      tags: ["网络协议", "TCP/UDP"]
    },
    {
      category: "操作系统",
      title: "进程间通信 (IPC) 有哪些方式？",
      content: "1. 管道 (Pipe)：匿名管道(父子进程)、命名管道(任意进程)。\n2. 消息队列 (Message Queue)。\n3. 共享内存 (Shared Memory)：最快，需要同步机制配合。\n4. 信号量 (Semaphore)：主要作为同步手段。\n5. 信号 (Signal)。\n6. 套接字 (Socket)：可用于不同机器间通信。",
      tags: ["OS", "IPC"]
    },
    {
      category: "C++11",
      title: "介绍一下 lambda 表达式的语法和使用场景",
      content: "语法：[capture](parameters) -> return_type { body }\n例如：auto add = [](int a, int b) { return a + b; };\n\n场景：\n1. 替代简单的函数对象 (Functor)。\n2. 作为 STL 算法 (如 sort, for_each) 的回调函数，使代码更紧凑。",
      tags: ["C++11", "新特性"]
    },
    {
      category: "数据结构",
      title: "红黑树的特性是什么？相比 AVL 树有什么优缺点？",
      content: "特性：\n1. 节点是红或黑。\n2. 根是黑。\n3. 叶子(NIL)是黑。\n4. 红节点的两个子节点必须是黑。\n5. 任意节点到每个叶子的路径包含相同数目的黑节点。\n\n对比 AVL：\nAVL 是严格平衡树，查询更快，但插入删除旋转多；红黑树是弱平衡，插入删除效率更高，适合 map/set 实现。",
      tags: ["树", "STL原理"]
    }
  ];