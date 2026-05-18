import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Fanyi',
  version: '0.1.0',
  description: '实时生成高质量 YouTube 双语字幕，支持用户自带 LLM Key。',
  permissions: ['storage', 'scripting'],
  host_permissions: [
    'https://www.youtube.com/*',
    'https://m.youtube.com/*',
    'https://*/*',
    'http://*/*',
  ],
  background: {
    service_worker: 'src/interface/background/service-worker.ts',
    type: 'module',
  },
  action: {
    default_title: 'Fanyi',
    default_popup: 'popup.html',
  },
  options_page: 'options.html',
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
      js: ['src/interface/content/caption-capture-main.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    },
    {
      matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
      js: ['src/interface/content/index.ts'],
      run_at: 'document_start',
    },
  ],
});
