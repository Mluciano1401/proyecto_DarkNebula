// Cuadrícula accesible superpuesta a la imagen, construida con D3.
// Patrón ARIA "grid" con roving tabindex: solo la celda activa tiene tabindex=0.

import { select, range } from 'd3';
import { t } from '../i18n/i18n.js';

export function createGrid(container, { onActivate, onMove, onToggle }) {
  const root = select(container).attr('role', 'grid');
  let analysis = null;
  const active = { row: 0, col: 0 };
  let playingEl = null;

  const cellEl = (row, col) => container.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  const cellData = (row, col) => analysis.cells[row * analysis.cols + col];

  function render(a) {
    analysis = a;
    playingEl = null;
    active.row = Math.min(active.row, a.rows - 1);
    active.col = Math.min(active.col, a.cols - 1);
    root.attr('aria-label', t('grid.label', { rows: a.rows, cols: a.cols }));
    const rowsData = range(a.rows).map((r) => a.cells.slice(r * a.cols, (r + 1) * a.cols));
    root
      .selectAll('div.grid-row')
      .data(rowsData)
      .join('div')
      .attr('class', 'grid-row')
      .attr('role', 'row')
      .selectAll('div.grid-cell')
      .data((d) => d)
      .join('div')
      .attr('class', (d) => (d.unusual ? 'grid-cell is-unusual' : 'grid-cell'))
      .attr('role', 'gridcell')
      .attr('data-row', (d) => d.row)
      .attr('data-col', (d) => d.col)
      .attr('aria-label', (d) => d.description)
      .attr('tabindex', (d) => (d.row === active.row && d.col === active.col ? 0 : -1));
  }

  function setActive(row, col, { focus = true, notify = true } = {}) {
    if (!analysis) return;
    row = Math.max(0, Math.min(analysis.rows - 1, row));
    col = Math.max(0, Math.min(analysis.cols - 1, col));
    const prev = cellEl(active.row, active.col);
    if (prev) prev.tabIndex = -1;
    active.row = row;
    active.col = col;
    const el = cellEl(row, col);
    el.tabIndex = 0;
    if (focus) el.focus();
    if (notify) onMove?.(cellData(row, col));
  }

  function highlight(cell) {
    playingEl?.classList.remove('is-playing');
    playingEl = cell ? cellEl(cell.row, cell.col) : null;
    playingEl?.classList.add('is-playing');
  }

  container.addEventListener('click', (e) => {
    const el = e.target.closest('.grid-cell');
    if (!el || !analysis) return;
    const row = +el.dataset.row;
    const col = +el.dataset.col;
    setActive(row, col, { notify: false });
    onActivate?.(cellData(row, col));
  });

  container.addEventListener('keydown', (e) => {
    if (!analysis || !e.target.closest('.grid-cell')) return;
    const { row, col } = active;
    const moves = {
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col],
      ArrowLeft: [row, col - 1],
      ArrowRight: [row, col + 1],
      Home: e.ctrlKey ? [0, 0] : [row, 0],
      End: e.ctrlKey ? [analysis.rows - 1, analysis.cols - 1] : [row, analysis.cols - 1],
      PageUp: [0, col],
      PageDown: [analysis.rows - 1, col],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [r, c] = moves[e.key];
      if (r !== row || c !== col) setActive(r, c);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onActivate?.(cellData(row, col));
    } else if (e.key === ' ') {
      e.preventDefault();
      onToggle?.();
    }
  });

  return {
    render,
    highlight,
    setActive,
    focusActive: () => cellEl(active.row, active.col)?.focus(),
    getActive: () => (analysis ? cellData(active.row, active.col) : null),
  };
}
