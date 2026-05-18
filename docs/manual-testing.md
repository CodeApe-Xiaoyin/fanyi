# Fanyi 联调清单

## 开始前

1. 在 Chrome 扩展管理页加载 `dist/`
2. 打开扩展的 `Options`
3. 如果要测试 LLM Provider，先在 `Providers` 页填写一个可用 provider
4. 先点击“测试当前草稿”，确认 provider 连通成功

## 推荐配置

1. `General` 页里把目标语言先设为 `zh-CN`
2. 源字幕偏好先设为 `en`
3. 如果你测的是公开视频或教程视频，建议先允许自动字幕回退
4. 在 `Styles` 或 popup 里分别调整中文大小、英文大小，并切换一次显示顺序

## 推荐测试视频类型

1. 英文技术教程
2. TED / 演讲类长句视频
3. 节奏较慢的产品发布会或 keynote
4. 自带人工英文字幕的视频

## 每次联调建议顺序

1. 改 provider 或模型后，先到 `General` 页清空字幕缓存
2. 打开一个带英文字幕的 YouTube 视频
3. 确认播放器控制栏出现 `译` 按钮，点击后可以开关 Fanyi
4. 等待页面底部出现 `Fanyi 正在抓取 YouTube 字幕...` 或字幕内容
5. 观察是否先出现 Google 初译双语字幕；如果配置了 active AI provider，继续观察是否逐批替换成更自然的 AI 润色字幕
6. 如果基础双语字幕没有出现，停止测试样式功能，先排查字幕获取日志
7. 确认中文/英文字号、字幕宽度、行高、英文高亮颜色可以实时生效，显示顺序可以在“中文在上”和“英文在上”之间切换
8. 全屏播放，确认字幕宽度和非全屏一致，不出现异常堆叠
9. 拖动进度条到未润色区域，确认字幕仍可显示，并观察 AI 润色是否按当前位置继续推进
10. 保存一个自定义样式模板，刷新 options 后确认模板仍可应用
11. 打开右侧 `Fanyi` 侧边栏，确认点击句子可以跳转

## 常见排查

1. 如果 provider 测试失败，回到 `Providers` 页检查是否已激活、模型名和密钥是否正确
2. 如果提示没有可靠字幕轨，先确认视频本身在 YouTube 内能打开字幕，或允许 YouTube 自动字幕
3. 如果已允许自动字幕仍提示没有字幕轨，打开 Options → Debug，优先查看 `content.track-selected`、`content.ensure-captions-result`、`content.source-capture-timeout`、`source-subtitles.fetch-error`
4. 如果 `source-subtitles.fetch-error` 显示 ASR `200 len=0`，确认错误详情里是否出现 `player request` 来源；没有的话说明页面没有收集到播放器真实 timedtext URL
5. 如果切换了模型但结果没变化，先清缓存再刷新页面
6. 如果页面字幕翻译失败，优先检查字幕轨、缓存和网络请求；主链路不依赖 LLM Provider
7. 如果中文视频也触发了抓取/翻译，优先检查 `content.track-selected` 是否错误选中了非英文轨道
8. 如果新打开视频出现播放器按钮报错，优先检查 `player-control-button.ts` 是否只把直接子节点传给 `insertBefore`
