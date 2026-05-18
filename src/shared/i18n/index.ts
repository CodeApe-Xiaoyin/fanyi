const messages = {
  zh: {
    appName: 'Fanyi',
    noProvider: '还没有配置 Provider',
  },
  en: {
    appName: 'Fanyi',
    noProvider: 'No provider configured yet',
  },
};

export type Locale = keyof typeof messages;

export function t(locale: Locale, key: keyof (typeof messages)['zh']): string {
  return messages[locale][key];
}
