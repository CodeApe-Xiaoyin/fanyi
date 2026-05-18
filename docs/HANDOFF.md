---
schema: neat/0.4
updated: 2026-05-18 23:35 UTC+8
sync_status: complete
project: Fanyi
path: E:/Code/Fanyi
branch: main
commit: 55e232e
worktree: clean
source: committed
---

## State
Fanyi v0.2.0 — 全面 UI/UX 改造完成。字幕内嵌工具栏、Anthropic 品牌浅色设置面板（居中对话框）、增强侧边栏（4 标签页）、点词翻译/AI 追问。代码已提交推送至 GitHub `main` 分支。tsc/test/build 全通过，待 Chrome 手动验证。

## Done
### Phase 1: 字幕工具栏 + 可点击单词
- 字幕内嵌 5 按钮工具栏（语言/字体/主题/设置/拖动），hover 淡入，每个按钮含下拉面板
- 拖拽改为仅 drag-handle 按钮触发，overlay 其他区域可文字选择
- 英文单词 span 添加 word-clickable 类 + hover 下划线 + click 事件
- Popup 添加背景开关/颜色/透明度控制
- 字幕背景框改为 fit-content 紧凑包裹文字

### Phase 2: 设置面板重构（Anthropic 品牌风格）
- 居中对话框（900×640px），毛玻璃遮罩，当前页面弹出不新开窗口
- Anthropic 品牌色：浅色主题 #faf9f5/#f3f2ed，Poppins 标题 + Lora 正文
- 橙色调强调 #d97757，蓝辅 #6a9bcc
- 7 页侧栏导航，15 个样式预设，实时预览
- 双入口：Options 页（浅色背景居中）+ YouTube 页内 SettingsModal

### Phase 3: 增强侧边栏
- React + Shadow DOM 侧边栏，视频右侧定位
- 4 标签页：字幕搜索/AI转录/总结+（AI摘要+深度思考）/片段（截图+导出）
- 新增 fanyi/ai-summarize、fanyi/ai-ask、fanyi/ai-transcribe 消息类型和后台 handler

### Phase 4: 点词翻译 + 发音 + ASK AI
- WordPopup 浮动弹窗（Shadow DOM）+ Web Speech API 发音 + ASK AI 追问

## Modified Files
- `subtitle-overlay.ts` — 工具栏集成 + fit-content 背景 + word-clickable + 拖拽重构
- `settings-panel.css` — Anthropic 品牌浅色主题重写（419行变更）
- `message-router.ts` — 3 个新 AI handler（summarize/ask/transcribe）
- `subtitle-style-presets.ts` — 4→15 预设
- `options/App.tsx` — 居中对话框布局

## Pending
- Chrome 加载 dist/ 手动验证全部新功能
- 侧边栏在 YouTube 页面缺少打开按钮入口
- speechSynthesis 在非英语系统上可用语音有限

## Risks
- YouTube DOM 结构变动可能影响侧边栏插入和工具栏定位
- DRM 视频截图会失败（已处理 SecurityError）

## Failed — Do Not Retry
- Active: 不要把字幕获取和字幕显示再塞回同一个 content 巨文件
- Active: 不要让 AI 成为首屏字幕阻塞方案；保持 Google 初译 + 后台 AI 润色
- Active: 不要只靠 tsc/lint/unit tests/build 判定完成；YouTube 真页验证是必须项

## Validation
build: verified (npm run build, 2026-05-18)
tests: verified (npm test, 62/62, 2026-05-18)
typecheck: verified (npx tsc --noEmit, 2026-05-18)
manual: not done

## Next
1. Chrome 加载 dist/ 验证工具栏、设置面板、侧边栏、点词弹窗
2. 修复发现的问题后重建并推送
3. 添加侧边栏打开按钮到 YouTube 页面

## Reference
- docs/CHANGES.md — 完整变更记录（25 新文件 + 9 修改）
- docs/architecture.md — 架构概览和字幕获取策略
- docs/manual-testing.md — YouTube 手动回归测试清单
