# Fanyi — YouTube 双语字幕 Chrome 扩展

## Tech Stack
- MV3 Chrome Extension + Vite + CRXJS + React 18 + TypeScript strict + Zustand + Tailwind + pnpm

## Commands
- Build: `npm run build` (tsc --noEmit && vite build → dist/)
- Test: `npm test` (vitest run)
- Dev: `pnpm dev`
- Load: Chrome → 扩展 → 加载 dist/ 目录

## Key Directories
```
src/
  interface/       — content script, popup, options, background (DOM/messaging)
  domain/          — use cases, models, ports, pure algorithms (no chrome.*/DOM)
  infrastructure/  — LLM providers, YouTube fetcher, storage, cache adapters
  composition/     — DI container (container.ts)
  shared/          — types, logger, error messages, timedtext parser
```

## Architecture
三层 hexagonal：interface → domain ← infrastructure。domain 不依赖外层。

主链路：
1. Content Script 检测 YouTube 视频 → 只选择英文字幕轨（`<script>` 标签解析失败时仍通过后台 player API 发现）→ 截获/抓取完整源字幕
2. Background `SubtitlePipelineUseCase.runWithSource()` 编排全流程
3. `SentenceReconstructor` 启发式断句（标点/长度/停顿，无 LLM）
4. `TranslateBatchUseCase` 用 `GoogleInstantTranslator` 32 路并发生成快速初译，通过 `onProgress` 回调渐进式输出
5. `TimestampAllocator` 把翻译映射回原始 cue 时间轴（支持部分翻译结果）
6. Background 通过 Chrome Port 流式推送 `PipelineProgressMessage`，Content Script 边翻边显示（前 10 句 + 每 20 句刷新）
7. 翻译完成后若配置 active AI provider，后台按播放位置优先润色字幕并实时替换
8. Content Script 在 Shadow DOM 渲染双语字幕 + 逐词高亮，并在 YouTube 控制栏挂载 `译` 开关按钮

## Translation Pipeline
- 首屏翻译：Google Translate (gtx endpoint)，不需要 API key
- AI 润色：active LLM provider 可在后台把 Google 初译改写成更自然的字幕；没有 provider 时保持 Google 译文
- 拿不到可靠字幕轨时停止处理并显示错误，不默认退回实时字幕 fallback
- YouTube ASR timedtext 可能要求播放器运行时参数（如 `pot/potc`）。主动抓取自动字幕时优先复用页面 `performance` 中播放器实际发出的 `/api/timedtext` URL，不要只依赖 `captionTracks.baseUrl`。
- LLM providers (OpenAI/Anthropic/Gemini/Custom) 不阻塞主链路；只用于 provider test、AI polish 和预留 live-translate API

## Critical Parameters
- `MAX_SENTENCE_CHARS = 80` (SentenceReconstructor.ts) — 过大导致字幕占半屏，过小导致断层
- `SILENCE_GAP_SEC = 1.2` (SentenceReconstructor.ts) — 停顿超过此值切句
- `TRANSLATE_CONCURRENCY = 32` (TranslateBatchUseCase.ts)
- `MAX_BRIDGE_GAP_SEC = 3` (subtitle-overlay.ts) — 句间间隙填充上限
- Pipeline timeout: 240s (content/index.ts withTimeout)

## Red Lines
- 不要在 domain/ 引用 chrome.* 或 DOM API
- 不要让 LLM 成为首屏字幕的阻塞步骤；长视频必须先用 Google 初译可看，再后台润色
- 不要把非英文视频默认送进抓取/翻译流程
- 修改断句参数后必须提醒用户清缓存（旧缓存断句不兼容）
- 触及 content/background 字幕获取链路后，必须真实加载 `dist/` 在 YouTube 验证双语字幕出现；`tsc`/lint/unit/build 通过不等于功能可用
- 基础字幕获取失败时，先修主链路，不要继续新增 popup/options 样式功能
- 保持 content 架构边界：获取、翻译/润色、显示/控制分离；改 UI 时不要顺手改字幕获取核心

## Entry Point for New Sessions
1. 读 docs/HANDOFF.md（先看 frontmatter 的 branch 和 sync_status）
2. 如果 branch 与当前 git branch 不一致 → 告知用户 handoff 可能过期
3. 如果 sync_status 为 partial → 先完成上次未完成的同步
4. 如果 commit 与当前 git log -1 不一致 → 提醒代码可能已变更
5. 读本文件（CLAUDE.md）获取项目背景
6. 不读其他文件，直到任务需要
