---
schema: neat/0.4
updated: 2026-05-04 11:50 UTC+8
sync_status: complete
project: Fanyi
path: D:/Code/Fanyi
branch: claude/stupefied-mirzakhani-b31245
commit: 7ddb1a7
worktree: dirty
source: uncommitted
---

## State
Fanyi YouTube 双语字幕扩展；本轮在 worktree 分支上完成了两项改进：修复字幕轨检测失败时误报"未检测到英文字幕"的 bug，以及实现渐进式翻译渲染（边翻边显示）。9 个文件已修改，tsc/test/build 全通过，dist 已同步到主仓库，等待用户 Chrome 加载验证。

## Done
- 修复 `extractCaptionTracks()` 从 `<script>` 标签解析失败（SPA 导航时序）时直接显示错误的问题：当 `trackCount === 0` 时不再放弃，改为继续走字幕获取流程（后台 player API / ytInitialPlayerResponse / performance entries / innertube transcript 有更强的轨道发现能力）。
- 获取到字幕后增加英文语言校验：发现的字幕不是英文时停止并给出明确提示，避免非英文视频进入翻译流程。
- 全链路渐进式翻译渲染：`TranslateBatchUseCase` 每翻完 10→20 句触发 `onProgress` → `SubtitlePipelineUseCase` 用 `TimestampAllocator` 生成部分 BilingualCue → `MessageRouter.handlePipelineStreaming()` 通过 Port 发送 `PipelineProgressMessage` → Content Script 边翻边渲染 + 更新进度文案。
- 导出 `isEnglishLanguage()` 用于内容脚本的源语言校验。

## Modified Files
- `src/interface/content/index.ts` — 核心流程改动：trackCount===0 时不放弃 + 英文语言校验 + 使用 streaming onProgress 渐进渲染
- `src/domain/use-cases/TranslateBatchUseCase.ts` — 新增 `onProgress` 回调（前 10 句 + 每 20 句）
- `src/interface/background/message-router.ts` — 新增 `handlePipelineStreaming()` 方法，通过 Port 流式推送进度
- `src/interface/content/messaging.ts` — 新增 `requestPipelineStreaming()` 函数，区分 progress/final 消息
- `src/shared/types.ts` — 新增 `PipelineProgressMessage` 类型

## Pending
- 用户真实加载 `dist/` 到 Chrome 验证：(1) 之前报"未检测到英文字幕"的视频现在能否正常显示字幕 (2) 字幕是否在 2-4s 内开始出现而不是等全部翻完 (3) loading 文案是否显示进度如"翻译中 48/320..."
- 字体族选择体验优化（HANDOFF 遗留未完成任务）
- 清理遗留 `live-translate`/`instant-translate` 预留接口

## Risks
- 本轮改动全部未提交（9 文件 +262/-16 行），在 worktree 分支 `claude/stupefied-mirzakhani-b31245` 上
- tsc/test/build 通过不等于 YouTube 功能可用；必须手动加载 dist/ 验证
- 渐进式渲染通过 Port 消息推送，如果 Port 在翻译过程中断开（用户快速切视频），progress 回调的 try/catch 会静默吞掉错误，不影响最终结果
- 英文语言校验依赖 `sourceLanguage` 字段准确性；某些 ASR 轨可能返回不准确的语言代码

## Failed — Do Not Retry
- Active: 不要把字幕获取和字幕显示再塞回同一个 content 巨文件；架构分割是明确要求
- Active: 不要让 AI 整批翻译作为阻塞首屏的唯一方案；必须保留快速 Google 初译 + 后台 AI 润色路径
- Active: 不要只靠 `tsc`/lint/unit tests/build 判定完成；YouTube 真页验证是必须项
- Active: 不要直接给 `captionTracks.baseUrl` 补 `kind/lang/fmt` 解决 ASR 空响应；需要播放器运行时 URL 参数

## Validation
build: passed (verified: `npm run build`, 2026-05-04 11:44 UTC+8)
tests: passed (verified: `npm test`, 31/31, 2026-05-04 11:44 UTC+8)
typecheck: passed (verified: `npx tsc --noEmit`, 2026-05-04 11:44 UTC+8)
manual: not done (unknown until Chrome reload + YouTube retest)

## Next
1. 在 Chrome 加载 `dist/` 目录，打开之前报"未检测到英文字幕"的视频，确认字幕正常出现。
2. 打开一个 10+ 分钟英文视频，确认字幕在 2-4s 内开始显示（渐进渲染），loading 文案显示翻译进度。
3. 测试中文视频确认跳过、测试 SPA 导航确认重新绑定正常。
4. 验证通过后提交 worktree 改动并合并到 main。

## Manual Notes
<!-- manual:start -->
<!-- manual:end -->

## Reference (do not read unless task requires)
- `docs/architecture.md` — 架构概览和字幕获取策略
- `docs/manual-testing.md` — YouTube 手动回归测试清单
