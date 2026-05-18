export function FeedbackPage(): JSX.Element {
  return (
    <div>
      <h1 className="sp-page-title">评论和反馈</h1>
      <div className="sp-control-group" style={{ marginBottom: 16 }}>
        <div className="sp-control-group-title">版本信息</div>
        <div className="sp-feedback-item">
          <span className="sp-feedback-label">当前版本</span>
          <span className="sp-feedback-value">v0.1.0</span>
        </div>
        <div className="sp-feedback-item">
          <span className="sp-feedback-label">技术栈</span>
          <span className="sp-feedback-value">MV3 + Vite + React 18 + TypeScript</span>
        </div>
        <div className="sp-feedback-item">
          <span className="sp-feedback-label">许可证</span>
          <span className="sp-feedback-value">MIT</span>
        </div>
      </div>
      <div className="sp-control-group">
        <div className="sp-control-group-title">反馈渠道</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="sp-btn" onClick={() => window.open('https://github.com', '_blank')}>
            GitHub Issues
          </button>
          <button className="sp-btn" onClick={() => navigator.clipboard.writeText('fanyi-extension@example.com').then(() => alert('邮箱已复制'))}>
            邮件反馈
          </button>
        </div>
      </div>
    </div>
  );
}
