export class ToolbarDropdown {
  readonly el: HTMLDivElement;
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toolbar-dropdown';
    this.el.style.display = 'none';

    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  setContent(nodes: Node[]): void {
    this.el.replaceChildren(...nodes);
  }

  show(anchorRect: DOMRect, containerRect: DOMRect): void {
    this.visible = true;
    this.el.style.display = 'flex';

    const centerX = anchorRect.left + anchorRect.width / 2 - containerRect.left;
    this.el.style.left = `${centerX}px`;
    this.el.style.transform = 'translateX(-50%)';
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.el.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(anchorRect: DOMRect, containerRect: DOMRect): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show(anchorRect, containerRect);
    }
  }
}

export function createCheckbox(
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void,
): HTMLLabelElement {
  const container = document.createElement('label');
  container.className = 'dropdown-checkbox';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));

  const text = document.createElement('span');
  text.textContent = label;

  container.append(input, text);
  return container;
}

export function createSlider(
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'dropdown-slider';

  const labelEl = document.createElement('span');
  labelEl.className = 'dropdown-slider-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'dropdown-slider-value';
  valueEl.textContent = `${value}%`;

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    valueEl.textContent = `${v}%`;
    onChange(v);
  });

  const header = document.createElement('div');
  header.className = 'dropdown-slider-header';
  header.append(labelEl, valueEl);
  row.append(header, input);
  return row;
}

export function createSelect(
  label: string,
  options: Array<{ value: string; label: string }>,
  current: string,
  onChange: (v: string) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'dropdown-select';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;

  const select = document.createElement('select');
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.value === current) el.selected = true;
    select.append(el);
  }
  select.addEventListener('change', () => onChange(select.value));

  row.append(labelEl, select);
  return row;
}

export function createColorChips(
  presets: Array<{ color: string; label: string }>,
  current: string,
  onChange: (color: string) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'dropdown-color-chips';

  for (const preset of presets) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'color-chip';
    if (preset.color.toLowerCase() === current.toLowerCase()) {
      chip.classList.add('active');
    }
    chip.style.setProperty('--chip-color', preset.color);
    chip.title = preset.label;
    chip.addEventListener('click', () => {
      row.querySelectorAll('.color-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      onChange(preset.color);
    });
    row.append(chip);
  }

  return row;
}
