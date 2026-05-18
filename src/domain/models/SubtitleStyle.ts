export interface SubtitleStyle {
  zhFontFamily: string;
  enFontFamily: string;
  zhColor: string;
  enColor: string;
  highlightColor: string;
  bottomOffsetPercent: number;
  /** 旧版统一字号倍率，保留用于迁移旧设置。新 UI 使用 zh/en 独立字号。 */
  scalePercent: number;
  zhFontSizePercent: number;
  enFontSizePercent: number;
  showChinese: boolean;
  showEnglish: boolean;
  maxWidthPercent: number;
  zhFontWeight: number;
  enFontWeight: number;
  lineOrder: 'zh-first' | 'en-first';
  lineGapPercent: number;
  lineHeightPercent: number;
  strokeWidth: number;
  shadowStrength: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  /**
   * 用户拖拽过字幕之后保存的位置（相对于播放器宽高的百分比，0-1）。
   * 没拖过就为 undefined，保留默认 bottom-12% 居中布局。
   * 用百分比是因为播放器在普通/影院/全屏间会变尺寸，存绝对像素会跑偏。
   */
  customPosition?: {
    leftPercent: number;
    topPercent: number;
  };
}
