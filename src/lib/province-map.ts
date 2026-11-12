/**
 * Behavior of the map of provinces (`ProvinceMap.astro`) in the browser: the selected province,
 * the click on a province, and the focus outline. The page decides what a pick does.
 */
export function setupProvinceMap(map: SVGSVGElement, onPick: (code: string) => void) {
  const links = [...map.querySelectorAll<SVGAElement>('a[data-province]')];
  const selectionPath = map.querySelector<SVGPathElement>('.province-map__selection')!;
  const focusPaths = [...map.querySelectorAll<SVGPathElement>('.province-map__focus-back, .province-map__focus')];
  const pathOf = (link: Element) => link.querySelector('path:not(.province-map__hit-area)')?.getAttribute('d') ?? '';

  map.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<SVGAElement>('a[data-province]');
    if (!link?.dataset.province) return;
    event.preventDefault();
    onPick(link.dataset.province);
  });
  // The focus outline is drawn above all provinces, so the neighbors do not cover it.
  map.addEventListener('focusin', (event) => {
    const link = (event.target as Element).closest('a[data-province]');
    const isVisible = link?.matches(':focus-visible');
    for (const path of focusPaths) {
      if (link && isVisible) path.setAttribute('d', pathOf(link));
      else path.removeAttribute('d');
    }
  });
  map.addEventListener('focusout', () => {
    for (const path of focusPaths) path.removeAttribute('d');
  });

  /** Marks one province as selected (or none, with an empty code). */
  const select = (code: string) => {
    for (const link of links) {
      const isSelected = link.dataset.province === code;
      link.classList.toggle('is-selected', isSelected);
      if (isSelected) {
        link.setAttribute('aria-current', 'location');
        selectionPath.setAttribute('d', pathOf(link));
      } else {
        link.removeAttribute('aria-current');
      }
    }
    if (!code) selectionPath.removeAttribute('d');
  };
  return { select };
}
