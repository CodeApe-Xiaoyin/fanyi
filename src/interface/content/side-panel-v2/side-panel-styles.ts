export const PANEL_CSS = `
:host {
  all: initial;
}
.sp2-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f172a;
  color: #e2e8f0;
  font: 400 13px/1.5 system-ui, -apple-system, sans-serif;
  overflow: hidden;
}
.sp2-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.sp2-tab {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 120ms, border-color 120ms;
}
.sp2-tab:hover { color: #e2e8f0; }
.sp2-tab.active {
  color: #93b4f5;
  border-bottom-color: #5b8def;
  font-weight: 600;
}
.sp2-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.sp2-search {
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  color: #e2e8f0;
  font-size: 12px;
  margin-bottom: 10px;
  box-sizing: border-box;
}
.sp2-search::placeholder { color: #64748b; }
.sp2-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sp2-cue {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  width: 100%;
}
.sp2-cue:hover { background: rgba(255,255,255,0.05); }
.sp2-cue.active { background: rgba(91,141,239,0.12); color: #93b4f5; }
.sp2-cue-time {
  color: #64748b;
  min-width: 44px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.sp2-cue-tl { color: #e2e8f0; font-weight: 600; }
.sp2-cue-en { color: #94a3b8; font-size: 11px; }
.sp2-empty {
  padding: 32px 0;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}
.sp2-summary-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sp2-summary-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: #64748b;
}
.sp2-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: #5b8def;
  border-radius: 50%;
  animation: sp2-spin 0.8s linear infinite;
}
@keyframes sp2-spin { to { transform: rotate(360deg); } }
.sp2-summary-result {
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.sp2-btn {
  padding: 8px 16px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  color: #e2e8f0;
  font-size: 12px;
  cursor: pointer;
}
.sp2-btn:hover { background: rgba(255,255,255,0.12); }
.sp2-btn.primary {
  background: #5b8def;
  border-color: #5b8def;
  color: #fff;
  font-weight: 600;
}
.sp2-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
.sp2-segment-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  margin: 8px 0;
}
.sp2-segment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.sp2-segment-row:hover { background: rgba(255,255,255,0.04); }
.sp2-segment-row.selected { background: rgba(91,141,239,0.14); }
.sp2-screenshot-preview {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}
.sp2-screenshot-preview img {
  width: 100%;
  display: block;
}
`;
