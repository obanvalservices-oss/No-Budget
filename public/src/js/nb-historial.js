/**
 * Iconos y acciones consistentes para listas / historial en dashboard.
 * Depende solo del DOM; incluir antes de los JS de cada módulo.
 */
(function (w) {
  const EDIT_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const TRASH_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

  /**
   * @param {'edit'|'delete'} kind
   * @param {string} extraAttrs ej: `data-id="1" class="nb-act-ingreso-edit"`
   */
  w.nbHistorialIconBtn = function nbHistorialIconBtn(kind, extraAttrs) {
    const label = kind === 'edit' ? 'Editar' : 'Eliminar';
    const svg = kind === 'edit' ? EDIT_SVG : TRASH_SVG;
    const cls =
      kind === 'edit' ? 'nb-icon-btn nb-icon-btn--edit' : 'nb-icon-btn nb-icon-btn--delete';
    const attrs = extraAttrs ? ' ' + extraAttrs : '';
    return `<button type="button" class="${cls}"${attrs} aria-label="${label}">${svg}</button>`;
  };

  w.nbHistorialActions = function nbHistorialActions(editAttrs, deleteAttrs) {
    return `<div class="nb-historial-actions">${w.nbHistorialIconBtn('edit', editAttrs)}${w.nbHistorialIconBtn('delete', deleteAttrs)}</div>`;
  };

  /** Par editar + eliminar con data-entity / data-action / data-id (delegación de eventos). */
  w.nbHistorialPair = function nbHistorialPair(entity, id) {
    const sid = String(id == null ? '' : id);
    return w.nbHistorialActions(
      `data-entity="${entity}" data-action="edit" data-id="${sid}"`,
      `data-entity="${entity}" data-action="delete" data-id="${sid}"`,
    );
  };
})(typeof window !== 'undefined' ? window : globalThis);
