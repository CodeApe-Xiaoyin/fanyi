export function toFriendlyErrorMessage(error: string): string {
  if (error.includes('没有可用的字幕轨')) {
    return [
      '当前视频没有可用字幕轨。',
      '你可以先在 YouTube 打开原生字幕，或者换一个带字幕的视频再试。',
    ].join('\n');
  }

  if (error.includes('字幕抓取失败')) {
    return [
      error,
      '可以刷新页面重试，或者先手动切换一次 YouTube 的字幕语言。',
    ].join('\n');
  }

  if (error.includes('返回了空响应体')) {
    return [
      error,
      '目标接口返回了空内容。若是字幕抓取，通常和 YouTube 字幕轨有关；若是 provider，则多半和代理配置或模型接口兼容性有关。',
    ].join('\n');
  }

  if (error.includes('请先在 Options 页面配置并激活一个 LLM Provider')) {
    return [
      '还没有可用的 LLM Provider。',
      '请先到 Options 页保存并激活一个 provider，然后重新打开当前视频。',
    ].join('\n');
  }

  if (error.includes('Provider request failed') || error.includes('request failed')) {
    return [
      error,
      '这通常是 baseURL、API Key、模型名或网络权限的问题，建议先在 Providers 页做连通性测试。',
    ].join('\n');
  }

  return error;
}
