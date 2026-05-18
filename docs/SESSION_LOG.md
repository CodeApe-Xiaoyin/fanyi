# Session Log

## 2026-04-29

### Goal
改进 popup/options 的字幕设置体验，让普通用户能理解并快速调整字体、颜色、字号、字幕顺序和 provider 配置；同时移除未真正使用且容易误导的字幕 fallback 策略。

### Changes
- Popup 顶部配置改为直接控制 Provider、目标语言和源字幕。
- Provider 管理支持编辑已有 provider。
- 字体族改为中文可读预设，并保留高级自定义输入。
- 颜色控件改为预设色块 + 自定义拾色器。
- “字重”改为“文字醒目程度”。
- 支持用户保存当前字幕样式为自定义模板。
- 字号改为中文大小、英文大小两个独立控制。
- 新增字幕顺序设置，可切换中文在上或英文在上。
- 移除 `subtitleFallbackMode` 设置和 popup/options 中的 fallback UI。
- 移除 content 默认实验实时 fallback；可靠字幕轨不可用时显示错误并停止。
- 更新交接文档、README、架构说明和手动测试清单，去掉默认 live fallback / Side Panel AI 润色的误导描述。

### Decisions
- 旧 `scalePercent` 暂不删除，只作为旧设置迁移来源保留。
- 默认不再启用实时字幕 fallback，因为它容易导致不同步、原生字幕叠加和阅读割裂。
- LLM 不进入主翻译链路；主链路继续使用 Google MT 并发翻译。
- 样式 UI 优先使用普通用户能理解的中文标签，避免直接暴露 CSS 术语。

### Failed Attempts
- `rg` 在当前 Windows 环境执行时返回 Access is denied；本轮改用 PowerShell `Get-ChildItem` 和 `Select-String` 搜索。

### Follow-ups
- 决定预留 live-translate 消息接口是否还要保留。
- 清理源码注释里残留的 “live mode / side panel AI 润色” 表述。
- 真实加载 `dist/`，验证 popup/options、新样式字段和自定义模板持久化。

## 2026-05-01

### Goal
响应用户对 popup 字幕来源、样式实时调整、模板显示和字幕宽度/行高的反馈，同时修复自动字幕 ASR 视频基础字幕获取失败的问题。

### Changes
- Content 增加设置变更监听：字幕来源/语言相关设置变化后会尝试重新处理当前视频，样式变化后会尝试实时更新 overlay。
- Popup 样式控件改为本地乐观更新并异步保存，减少拖动滑杆时的卡顿和“保存但看不到效果”的错觉。
- Popup “当前样式”下拉改为根据当前样式匹配内置模板或用户保存模板；无法匹配时显示“自定义”。
- Overlay 和样式模型增加字幕宽度、行高等显示能力，用于减少中文字幕三行以上换行。
- 尝试改进 YouTube 字幕获取：打开字幕轨后调用 `toggleSubtitlesOn()`，主动抓取时读取 `movie_player` tracklist，截获 buffer 按 videoId 复用。
- 用户提供 Debug 日志后定位真实根因：视频 `474wZZHoWN4` 的 ASR `captionTracks.baseUrl` 及常见 `fmt` variants 均返回 `200 len=0`，而 YouTube 播放器实际请求带 `potc=1&pot=...`、`xorb/xobt/xovt` 和 client 参数。
- `fetchSourceSubtitles` 新增从页面 `performance.getEntriesByType('resource')` 读取已记录的 `/api/timedtext` 请求，优先复用播放器真实 timedtext URL。
- `SourceSubtitlesPayload` 增加 `videoId`，用于过滤当前视频的 performance timedtext 记录。
- 更新 `docs/HANDOFF.md`，把当前状态改为 ASR 空响应修复已实现、真实用户侧重载验收待确认。

### Decisions
- 在基础字幕获取恢复前，不应继续新增 UI 功能。
- 样式实时更新应只更新 overlay 样式，不应重新跑翻译 pipeline。
- 命令级验证不能代替真实 YouTube 验收；触及 content/background 字幕链路后必须手动加载 `dist/` 验证。
- 新版 YouTube ASR 主动抓取应优先尝试播放器实际生成的 timedtext URL，因为它可能包含 proof-of-origin token (`pot`)；裸 `captionTracks.baseUrl` 只能作为后备候选。

### Failed Attempts
- 多次改进自动字幕允许项和 ensure captions 后，用户截图仍显示“未获取到可用字幕轨”。说明当前问题不能只靠 UI 设置或简单打开 CC 解决，需要看 Debug 日志定位 track 发现、capture timeout 或 timedtext fetch 的具体失败点。
- `tsc`、lint、23 个单测和 build 全部通过，但真实 YouTube 页面基础字幕获取仍失败；不要再把这些命令通过当作功能完成。
- 第一轮修复只处理了 track 候选结构和 `ensureCaptions` 等待时序，没有解决 `200 len=0`。用户日志证明真正问题是 ASR timedtext 需要播放器运行时 URL 参数。
- 直接给 `captionTracks.baseUrl` 补 `kind/lang/fmt=json3/srv3/vtt/ttml` 仍为空；不要重复把 ASR 空响应当成普通 URL variant 问题。

### Follow-ups
- 用户需要重新加载最新 `dist/`，用 `474wZZHoWN4` 和另一个自动字幕视频复验双语字幕是否出现。
- 如果仍失败，打开 Options → Debug，确认 `source-subtitles.fetch-error` 是否尝试了 `player request` 来源。
- 清理 `requestLiveTranslate`、`requestInstantTranslate`、`LiveTranslatePayload` 等预留接口和源码注释中残留的 live mode / Side Panel AI 润色表述。

## 2026-05-02

### Goal
按用户要求把字幕获取、翻译润色和显示控制分层，优先保证完整字幕快速获取和 AI 润色译文，同时修复全屏样式、无字幕提示、播放器控制按钮、英文-only 视频判断和高亮颜色自定义。

### Changes
- Content script 拆成编排层、source subtitles、translated subtitles、AI polish scheduler、display session、overlay 和 player control button，减少 UI 改动污染字幕获取核心的风险。
- 新增 MAIN world 早期 capture hook 和 YouTube SPA 重新绑定逻辑，改善“新视频需要刷新才运行”的情况。
- 字幕流程改为完整源字幕优先：Google 快速初译先显示，配置 active AI provider 后后台批量润色，按当前播放时间和 seek 位置重排优先级并写回缓存。
- 新增英文轨道筛选：只有英文字幕视频自动抓取翻译，中文视频跳过。
- Overlay 支持中文/英文显示开关、全屏宽度优化、错误提示约 15 秒自动隐藏、当前英文词文字变色 + 下划线，以及自定义英文高亮颜色实时更新。
- 新增 YouTube 播放器控制栏 `译` 按钮，并修复 `insertBefore` 锚点不是直接子节点导致的新视频报错。
- 新增/更新单元测试：架构边界、AI 润色响应解析、英文-only 字幕轨选择、ASR rolling cue 解析。

### Decisions
- 继续保留 Google 作为首屏快速译文来源；AI provider 只做后台润色，不阻塞视频开始观看。
- 对未润色区间优先保持可用字幕体验；拖动到未润色区域时由 scheduler 重新按当前位置优先润色。
- 非英文视频默认不进入抓取/翻译流程，避免中文视频浪费资源和干扰观看。
- 播放器内按钮属于显示/控制层，不触碰 `source-subtitles.ts` 的获取核心。

### Failed Attempts
- 首版播放器控制按钮用 `querySelector('.ytp-subtitles-button')` 作为 `insertBefore` 参考节点；YouTube 某些新视频 DOM 中该节点不是 `.ytp-right-controls` 的直接子节点，导致浏览器抛错。已改为只查直接子节点，找不到则安全插到控制栏开头。
- Windows 环境中 `rg` 继续出现 Access is denied；本轮仍使用 PowerShell `Select-String` 和文件读取替代。

### Validation
- `node .\node_modules\typescript\bin\tsc --noEmit`: passed
- `npm run lint`: passed
- `npm test`: passed, 31/31
- `npm run build`: passed
- Manual YouTube reload/regression: not done after latest build

### Follow-ups
- Reload `dist/` and test English ASR, English manual captions, Chinese video skip, no-subtitle auto-hide, SPA navigation, fullscreen, player control button, and AI polish update behavior.
- If subtitle acquisition regresses again, inspect Options -> Debug events before changing acquisition code.

## 2026-05-04

### Goal
修复用户报告的"未检测到英文字幕"bug（ASR 字幕应可用但未被检测到），以及实现渐进式翻译渲染加速首屏字幕出现时间。

### Changes
- 修复 `content/index.ts` 中 `selectEnglishCaptionTrack` 返回 undefined 且 `trackCount === 0` 时直接报错退出的问题：改为继续走字幕获取流程，后台 fetchSourceSubtitles 有 player API / ytInitialPlayerResponse / performance entries / innertube transcript 多重发现机制。
- 获取到字幕后增加英文语言校验（导出 `isEnglishLanguage` from `caption-track-selection.ts`），避免非英文视频误入翻译流程。
- 全链路渐进式翻译渲染：`TranslateBatchUseCase` 新增 `onProgress`（前 10 句 + 每 20 句）→ `SubtitlePipelineUseCase` 用 allocator 生成部分 BilingualCue → `MessageRouter.handlePipelineStreaming()` 通过 Port 发 `PipelineProgressMessage` → Content Script 边翻边渲染。
- `messaging.ts` 新增 `requestPipelineStreaming()` 区分 progress/final 消息。
- `service-worker.ts` 路由 pipeline 消息到 streaming handler。
- `types.ts` 新增 `PipelineProgressMessage` 接口。

### Decisions
- trackCount === 0 场景不放弃是因为 `<script>` 标签解析在 SPA 导航时经常失败，但后台有更可靠的轨道发现源。
- trackCount > 0 但无英文轨仍跳过（确认的非英文视频）。
- 渐进式渲染只改 pipeline 内部通讯，不改 allocator/segmenter/overlay 等已有模块。
- Google MT 仍是首屏第一优先级，AI 润色仍是后台第二步，优先级未改变。

### Failed Attempts
- 首次编辑 MessageRouter 时遗漏了 handlePipeline 方法的闭合大括号，产生多余 `}`；通过 tsc 立即发现并修复。

### Validation
- `npx tsc --noEmit`: passed
- `npm test`: passed, 31/31
- `npm run build`: passed
- Manual YouTube: not done (等待用户加载 dist/ 验证)

### Follow-ups
- 用户验证之前报"未检测到英文字幕"的视频是否恢复正常。
- 用户验证渐进式渲染效果：字幕是否在 2-4s 内出现、进度文案是否更新。
- 验证通过后提交 worktree 改动到分支并合并 main。
- 字体族选择体验优化仍待处理。

## 2026-05-18

### Goal
按用户需求文档实现 4 大 UI 功能模块：字幕内嵌工具栏 + 可点击单词、设置面板重构（Anthropic 品牌风格）、增强侧边栏（4 标签页）、点词翻译/发音/ASK AI，并部署到 GitHub。

### Changes
- Phase 1: 新建 subtitle-toolbar.ts、toolbar-dropdown.ts；subtitle-overlay.ts 集成工具栏、拖拽重构为仅 drag-handle、英文单词添加 word-clickable 点击事件；popup 添加背景控制；背景框从 width:78% 改为 fit-content 紧凑包裹文字
- Phase 2: 新建 SettingsPanel、SettingsNav、7 个设置页面、LivePreview、StylePresetCard、settings-modal.ts；Presets 从 4 个扩展为 15 个；Anthropic 品牌色 (#faf9f5 浅色主题、Poppins/Lora 字体、#d97757 橙色强调)；对话框改为居中 900×640px
- Phase 3: 新建 SidePanelHost、SidePanelApp、4 个标签页组件；新增 fanyi/ai-summarize、fanyi/ai-ask、fanyi/ai-transcribe 消息类型和后台 handler
- Phase 4: 新建 WordPopup、pronunciation.ts；Web Speech API 发音 + ASK AI 追问
- Phase 5: git init、创建 GitHub 仓库 (CodeApe-Xiaoyin/fanyi)、写 README.md、docs/CHANGES.md
- 安装 GitHub MCP、Chrome DevTools MCP、neat skill

### Decisions
- 采用 Anthropic brand-guidelines 技能规范设计 UI：浅色主题、Poppins 标题 + Lora 正文、橙色主强调色
- 设置面板使用居中对话框而非全屏，带毛玻璃遮罩
- 侧边栏和设置面板均用 React + Shadow DOM 隔离，懒加载避免 content script 包体膨胀
- 核心翻译管线（PipelineUseCase、SentenceReconstructor、TranslateBatchUseCase）完全不触摸
- AI 功能走新增独立消息类型，不复用翻译链路

### Failed Attempts
- frontend-design skill 在环境中不可用（未注册为 Claude Code skill），改为直接应用 Anthropic brand-guidelines 规范手写 CSS

### Validation
- npx tsc --noEmit: passed (0 errors)
- npm run build: passed (831ms)
- npm test: passed (62/62)
- Manual YouTube: not done

### Follow-ups
- Chrome 加载 dist/ 验证所有新功能
- 添加侧边栏打开按钮到 YouTube 页面
- 修复发现的问题后重建并推送
