# Fanyi v0.2.0 — 功能扩展变更记录

## 新建文件

### Phase 1: 字幕内嵌工具栏 + 可点击单词 + Popup 背景控制

| 文件 | 用途 |
|------|------|
| `src/interface/content/subtitle-toolbar.ts` | 5 按钮工具栏（语言显示/字体大小/主题样式/设置/拖动），hover 淡入显示，每个按钮含下拉面板 |
| `src/interface/content/toolbar-dropdown.ts` | 通用下拉面板容器 + checkbox/slider/select/color-chips UI 控件工厂 |

### Phase 2: 设置面板重构

| 文件 | 用途 |
|------|------|
| `src/interface/shared-ui/settings-panel/SettingsPanel.tsx` | 设置面板根组件，左侧导航 + 右侧内容路由 |
| `src/interface/shared-ui/settings-panel/SettingsNav.tsx` | 左侧 7 项导航栏 + 恢复出厂设置按钮 |
| `src/interface/shared-ui/settings-panel/settings-panel.css` | 面板全部样式（暗色主题、响应式） |
| `src/interface/shared-ui/settings-panel/pages/SubtitleLanguagePage.tsx` | 字幕语言页：扩展开关、目标语言、源字幕偏好 |
| `src/interface/shared-ui/settings-panel/pages/SubtitleStylePage.tsx` | 字幕样式页：实时预览、15 个样式预设、全部样式控制 |
| `src/interface/shared-ui/settings-panel/pages/YouTubeThemePage.tsx` | YouTube 主题页（占位） |
| `src/interface/shared-ui/settings-panel/pages/TranslationSettingsPage.tsx` | 翻译设置页：LLM provider 管理（添加/编辑/测试/删除/激活） |
| `src/interface/shared-ui/settings-panel/pages/WebTranslatePage.tsx` | 网页翻译页（占位） |
| `src/interface/shared-ui/settings-panel/pages/AccessibilityPage.tsx` | 辅助功能页：缓存管理、扩展信息 |
| `src/interface/shared-ui/settings-panel/pages/FeedbackPage.tsx` | 评论和反馈页：版本信息、反馈渠道 |
| `src/interface/shared-ui/settings-panel/components/LivePreview.tsx` | 实时字幕预览卡片（视频背景 + 当前样式预览） |
| `src/interface/shared-ui/settings-panel/components/StylePresetCard.tsx` | 样式预设卡片（色块预览 + 名称） |
| `src/interface/content/settings-modal.ts` | YouTube 页面内设置模态框（Shadow DOM + React 懒加载） |

### Phase 3: 增强侧边栏

| 文件 | 用途 |
|------|------|
| `src/interface/content/side-panel-v2/SidePanelHost.ts` | Shadow DOM 容器 + React root 管理 + 视频右侧定位 |
| `src/interface/content/side-panel-v2/SidePanelApp.tsx` | React 根组件，4 标签页路由 |
| `src/interface/content/side-panel-v2/side-panel-styles.ts` | 面板 CSS（Constructable Stylesheet） |
| `src/interface/content/side-panel-v2/use-video-time.ts` | React Hook：`useVideoTime(video)` 实时获取播放位置 |
| `src/interface/content/side-panel-v2/tabs/SubtitleTab.tsx` | 字幕标签页：搜索框 + 时间戳 + 双语列表 + 点击跳转 + 当前句高亮 |
| `src/interface/content/side-panel-v2/tabs/TranscriptionTab.tsx` | AI 转录标签页：句子分组、翻译来源标签 |
| `src/interface/content/side-panel-v2/tabs/SummaryTab.tsx` | 总结+标签页：AI 摘要生成 + 深度思考 + 复制 |
| `src/interface/content/side-panel-v2/tabs/SegmentsTab.tsx` | 片段标签页：选句截图 + Canvas 渲染字幕 + 导出长图 |

### Phase 4: 点词翻译 + 发音 + ASK AI

| 文件 | 用途 |
|------|------|
| `src/interface/content/word-popup/WordPopup.ts` | 浮动翻译弹窗（Shadow DOM）：原文 + 译文 + 发音 + ASK AI |
| `src/interface/content/word-popup/pronunciation.ts` | Web Speech API 封装：`speak(text, lang)`、`stopSpeaking()` |

---

## 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/interface/content/subtitle-overlay.ts` | +集成 SubtitleToolbar 到 overlay DOM；+拖拽仅 drag-handle 触发；+`.zh`/`.en` 行 `user-select:text`；+word `<span>` 添加 `word-clickable` 类 + click 事件；+`onWordClick`/`onTextSelected`/`onStyleChange`/`onOpenSettings` 回调；+`getToolbarCSS()` 注入到 Constructable Stylesheet |
| `src/interface/content/subtitle-display-session.ts` | +移除旧 `SidePanel` 引用；+懒加载 `SidePanelHost`；+`toggleSidePanel()`/`showSidePanel()`/`hideSidePanel()` 方法；+`handleWordClick()` 实例化 WordPopup 并调用 instant-translate + ai-ask |
| `src/interface/content/index.ts` | +`onStyleChange` → `updateStyleSettings()` 持久化工具栏变更；+`onOpenSettings` → 懒加载 `SettingsModal` 页面内弹窗；+`settingsModal` 模块级引用 |
| `src/interface/popup/App.tsx` | +字幕背景开关 checkbox、背景颜色 color input、背景不透明度 slider（0-85%） |
| `src/interface/options/App.tsx` | 重写：移除旧 5 页结构，改为渲染 `<SettingsPanel>`（共用组件） |
| `src/interface/background/message-router.ts` | +`AiSummarizePayload/Response/AiAskPayload/AiTranscribePayload` 导入；+`handleAiSummarize()`/`handleAiAsk()`/`handleAiTranscribe()` 3 个 handler；所有复用 `createProvider()` + active provider 模式 |
| `src/shared/types.ts` | +`AiSummarizePayload/Response`、`AiAskPayload/Response`、`AiTranscribePayload/Response` 接口；+`MessageMap` 新增 `fanyi/ai-summarize`、`fanyi/ai-ask`、`fanyi/ai-transcribe` |
| `src/shared/subtitle-style-presets.ts` | 从 4 个预设扩展为 15 个：默认风格、清透白、描边、投影、笔记风、磨砂蓝、霓虹紫、影院、深海蓝、黑板风、终端绿、紧凑、桃气粉、枫叶橙、高对比 |
| `.gitignore` | +`.claude/` |

---

## 功能效果

1. **字幕工具栏**：hover 字幕时出现 5 按钮工具栏，可快速切换语言显示、调节字号、切换主题预设、打开设置面板、拖动字幕位置
2. **可点击单词**：英文单词 hover 显示下划线，点击弹出翻译弹窗（翻译 + 发音 + ASK AI）
3. **设置面板**：现代化侧栏导航，7 个页面，15 个样式预设，实时预览，Options 页 + YouTube 页内弹窗双入口
4. **增强侧边栏**：视频右侧 4 标签页（字幕搜索/AI转录/AI总结/截图片段），React + Shadow DOM 隔离
5. **点词翻译**：点击英文单词弹出浮窗，支持即时翻译、真人发音（Web Speech API）、AI 追问
