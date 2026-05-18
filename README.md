# Fanyi

YouTube 双语字幕 Chrome 扩展。自动抓取英文视频字幕，通过 Google 翻译快速生成中英双语字幕覆盖在视频上，并可用用户配置的 AI Provider 在后台润色成更自然的译文。

## 功能

### 核心翻译
- 自动抓取 YouTube 字幕（含 ASR 自动生成字幕）
- Google MT 即时翻译（无需 API Key，32 路并发）
- 可选 AI 润色：先显示 Google 初译，再后台替换为更自然的 AI 润色字幕
- 渐进式翻译渲染（边翻边显示，2-4s 出首屏）

### 字幕显示
- Shadow DOM 双语字幕渲染（不影响页面样式）
- 逐词高亮跟读，支持自定义英文高亮颜色
- 字幕拖拽定位
- 15 个内置样式预设（标准/清透白/描边/投影/影院/霓虹紫/黑板风/终端绿 等）
- 字幕背景框（可开关、可自定义颜色和透明度）

### 字幕工具栏
- hover 字幕时显示 5 按钮工具栏：
  - **语言显示**：中/英文开关、行序切换
  - **字体大小**：中/英字号调节
  - **主题样式**：预设模板 + 背景开关/颜色/透明度
  - **设置**：打开设置面板
  - **拖动**：拖拽字幕位置

### 点词翻译 + ASK AI
- 点击英文字幕单词弹出翻译弹窗
- Web Speech API 真人发音
- ASK AI 智能追问（需配置 LLM provider）

### 设置面板
- 7 页现代化侧栏导航：字幕语言 / 字幕样式 / YouTube 主题 / 翻译设置 / 网页翻译 / 辅助功能 / 评论反馈
- 实时字幕预览
- 15 个官方样式预设 + 自定义预设
- LLM provider 管理（OpenAI/Anthropic/Gemini/Custom）

### 增强侧边栏
- 4 个标签页（视频右侧，非全屏）：
  - **字幕**：搜索 + 时间戳 + 双语列表 + 点击跳转
  - **AI 转录**：句子分组、翻译来源标签
  - **总结+**：AI 摘要 + 深度思考 + 复制
  - **片段**：选句截图 + Canvas 字幕叠加 + 导出长图

### 其他
- Popup 快捷控制台：语言、Provider、源字幕偏好、样式控制
- YouTube 控制栏「译」按钮
- IndexedDB 翻译缓存

---

## 本地启动

1. 安装依赖：`npm install` 或 `pnpm install`
2. 构建：`npm run build`
3. 在 Chrome → 扩展 → 开发者模式 → 加载 `dist/` 目录

## 开发

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 开发模式（HMR） |
| `npm run build` | tsc + vite build → dist/ |
| `npm test` | vitest 测试 |
| `npm run lint` | ESLint 检查 |

---

## 主要目录

```
src/
  interface/         — Content Script、Popup、Options、Background
  domain/            — 用例、模型、端口、纯算法
  infrastructure/    — LLM Provider、YouTube 抓取、缓存、存储适配器
  composition/       — 依赖注入容器
  shared/            — 共享类型、工具函数、字幕预设
```

## 架构

三层六边形：`interface → domain ← infrastructure`。domain 不依赖 chrome.* 或 DOM。

主数据流：
1. Content Script 检测 YouTube 视频 → 截获英文字幕
2. Background `SubtitlePipelineUseCase` 编排处理流程
3. Google 翻译 32 路并发初译 → 渐进式渲染
4. AI Provider 后台润色（非阻塞）
5. Shadow DOM 渲染双语字幕 + 逐词高亮

## 技术栈

MV3 + Vite + CRXJS + React 18 + TypeScript strict + Zustand + Tailwind + pnpm

## 配置 AI Provider

1. 打开扩展设置面板（选项页 或 字幕工具栏 → 设置）
2. 进入「翻译设置」页
3. 添加 Provider（支持 OpenAI-Compatible / Anthropic / Gemini / Custom）
4. 填写 API Key、Model 等信息
5. 点击「测试连接」验证
6. 点击「激活」启用

AI Provider 用于：
- 字幕 AI 润色（Google 初译 → LLM 优化）
- 点词 ASK AI 追问
- 视频总结（总结+标签页）

---

## License

MIT
