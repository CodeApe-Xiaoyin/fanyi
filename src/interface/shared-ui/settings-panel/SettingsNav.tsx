export type SettingsPage =
  | 'subtitle-language'
  | 'subtitle-style'
  | 'youtube-theme'
  | 'translation-settings'
  | 'web-translate'
  | 'accessibility'
  | 'feedback';

const PAGES: Array<{ id: SettingsPage; label: string; icon: string }> = [
  { id: 'subtitle-language', label: '字幕语言', icon: '⊕' },
  { id: 'subtitle-style', label: '字幕样式', icon: '⊤' },
  { id: 'youtube-theme', label: 'YouTube 主题', icon: '⊘' },
  { id: 'translation-settings', label: '翻译设置', icon: '文' },
  { id: 'web-translate', label: '网页翻译', icon: '□' },
  { id: 'accessibility', label: '辅助功能', icon: '♿' },
  { id: 'feedback', label: '评论和反馈', icon: '□' },
];

interface SettingsNavProps {
  activePage: SettingsPage;
  onPageChange: (page: SettingsPage) => void;
}

export function SettingsNav({ activePage, onPageChange }: SettingsNavProps): JSX.Element {
  return (
    <nav className="sp-nav">
      <div className="sp-nav-brand">S 设置</div>
      <div className="sp-nav-items">
        {PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            className={`sp-nav-item${page.id === activePage ? ' active' : ''}`}
            onClick={() => onPageChange(page.id)}
          >
            <span className="sp-nav-icon">{page.icon}</span>
            <span>{page.label}</span>
          </button>
        ))}
      </div>
      <div className="sp-nav-footer">
        <button
          type="button"
          className="sp-reset-btn"
          onClick={() => {
            if (window.confirm('确定要恢复出厂设置吗？这将清除所有配置和缓存。')) {
              window.postMessage({ type: 'fanyi-reset-settings' }, '*');
            }
          }}
        >
          恢复出厂设置
        </button>
      </div>
    </nav>
  );
}
