export function AboutPage(): JSX.Element {
  return (
    <section className="stack-lg">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2>当前实现范围</h2>
          <p className="muted">已完成项目骨架、主链路基础实现与配置界面。</p>
        </div>
      </div>

      <div className="content-card stack-md">
        <h3>已经落地</h3>
        <ul className="plain-list">
          <li>Manifest V3 + background/content/options/popup 多入口骨架</li>
          <li>OpenAI-compatible、Anthropic、Gemini、Custom Template provider 接入</li>
          <li>字幕抓取、断句、翻译、时间戳重分配与逐词高亮估算版</li>
          <li>字幕轨偏好选择、Provider 连通性测试、缓存清理入口</li>
        </ul>
      </div>

      <div className="content-card stack-md">
        <h3>联调建议</h3>
        <ul className="plain-list">
          <li>先在 Providers 页测试草稿连通性，再去 YouTube 实测</li>
          <li>切换模型或 provider 后，先到 General 页清一次缓存</li>
          <li>联调步骤可直接看 [docs/manual-testing.md](/D:/Code/Fanyi/docs/manual-testing.md)</li>
        </ul>
      </div>
    </section>
  );
}
