# Fanyi 架构说明

本项目遵循规划书中的三层结构：

1. `interface/` 只处理 DOM、React 页面和消息通信。
2. `domain/` 只负责用例编排和纯算法，不引用 `chrome.*` 或 DOM。
3. `infrastructure/` 实现外部 IO，包括 YouTube 字幕抓取、LLM 请求、存储和缓存。

当前主链路：

1. Content Script 检测 YouTube 视频，只选择英文字幕轨，并截获/抓取完整源字幕 (TimedtextFetcher / capture hook / page bridge)。
2. Background 组装 `SubtitlePipelineUseCase` 并执行。
3. Pipeline：缓存查询 → 字幕抓取 → 启发式断句 (`SentenceReconstructor`) → Google MT 并发翻译 (`GoogleInstantTranslator`, 32 路) → 时间戳分配 (`TimestampAllocator`)。
4. Content Script 先显示 Google 初译；如果存在 active AI provider，`AiPolishScheduler` 后台按当前播放位置优先润色字幕，并实时替换已显示结果。
5. Content Script 在 Shadow DOM 中以句子为单位渲染双语字幕，逐词高亮，并在 YouTube 控制栏挂载 `译` 开关按钮。

翻译策略（2026-04-29 调整）：
- 首屏链路用 Google MT（gtx endpoint），不需要 API Key，优先保证用户尽快开始观看。
- AI provider 不阻塞首屏，只做后台润色；没有 active provider 时保持 Google 译文。
- 拿不到可靠字幕轨时直接停止并显示错误，不默认切到实时字幕 fallback。
- LLM providers 当前用于 provider test、AI polish 和预留的 live-translate 消息接口。

Content 边界（2026-05-02 调整）：
- `index.ts` 只负责编排。
- `source-subtitles.ts` 负责字幕获取。
- `translated-subtitles.ts` / `ai-polish-scheduler.ts` 负责 Google 初译和 AI 润色调度。
- `subtitle-display-session.ts` / `subtitle-overlay.ts` / `player-control-button.ts` 负责显示、样式、错误提示和播放器内控制。

字幕获取策略（2026-05-01 调整）：
- 首选截获 YouTube 播放器自己的 timedtext 响应。
- 如果截获超时，Background 在页面 MAIN world 主动抓取字幕。
- 对 YouTube ASR 自动字幕，主动抓取优先复用 `performance.getEntriesByType('resource')` 中播放器实际发出的 `/api/timedtext` URL，因为该 URL 可能包含 `pot/potc` 等运行时 proof 参数；裸 `captionTracks.baseUrl` 可能返回 `200` 空内容。
- 若没有 player request，再回退到 content script 传入的 track、`ytInitialPlayerResponse/getPlayerResponse()` 和 `movie_player` tracklist。

扩展点：

- `ProviderRegistry` 已接入 OpenAI-compatible、Anthropic、Gemini、Custom Template。
- `IAuthGate` / `ITelemetry` 已预留商业化切换点。
- `IndexedDBCacheAdapter` 可继续扩展为批次级断点续传缓存。
