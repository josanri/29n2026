/**
 * Behavior of the map of provinces (`ProvinceMap.astro`) in the browser: the selected province,
 * the click on a province, and the focus outline. The page decides what a pick does.
 */
export function setupProvinceMap(map: SVGSVGElement, onPick: (code: string) => void) {
  const links = [...map.querySelectorAll<SVGAElement>('a[data-province]')];
  const selectionPath = map.querySelector<SVGPathElement>('.province-map__selection')!;
  const focusPaths = [...map.querySelectorAll<SVGPathElement>('.province-map__focus-back, .province-map__focus')];
  const pathOf = (link: Element) => link.querySelector('path:not(.province-map__hit-area)')?.getAttribute('d') ?? '';

  // The Canary Islands are small, and on a phone a finger does not hit them. The whole inset is a halo:
  // a point in the frame belongs to the province whose outline is nearest. The outlines are sampled once.
  const frame = map.querySelector<SVGRectElement>('.province-map__frame--canarias');
  const canarian = links.filter((link) => link.hasAttribute('data-canarian'));
  const outlinePoints = canarian.map((link) => {
    const path = link.querySelector<SVGPathElement>('path:not(.province-map__hit-area)')!;
    const length = path.getTotalLength();
    const points: { x: number; y: number }[] = [];
    for (let at = 0; at <= length; at += 1.5) {
      const point = path.getPointAtLength(at);
      points.push({ x: point.x, y: point.y });
    }
    return { link, points };
  });
  /** The Canarian link nearest to a point of the screen, or none when the point is outside the inset. */
  const canarianAt = (clientX: number, clientY: number) => {
    const matrix = map.getScreenCTM();
    if (!frame || !matrix || outlinePoints.length === 0) return undefined;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    const x = frame.x.baseVal.value;
    const y = frame.y.baseVal.value;
    if (point.x < x || point.x > x + frame.width.baseVal.value || point.y < y || point.y > y + frame.height.baseVal.value) return undefined;
    let best: { link: SVGAElement; distance: number } | undefined;
    for (const { link, points } of outlinePoints) {
      for (const outline of points) {
        const distance = (outline.x - point.x) ** 2 + (outline.y - point.y) ** 2;
        if (!best || distance < best.distance) best = { link, distance };
      }
    }
    return best?.link;
  };
  let nearLink: SVGAElement | undefined;
  const setNear = (link: SVGAElement | undefined) => {
    if (link === nearLink) return;
    nearLink?.classList.remove('is-near');
    link?.classList.add('is-near');
    map.classList.toggle('is-near-canary', Boolean(link));
    nearLink = link;
  };
  map.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const direct = (event.target as Element).closest('a[data-province]');
    // A real hover on a province already paints it: the halo is only for the empty part of the inset.
    setNear(direct ? undefined : canarianAt(event.clientX, event.clientY));
  });
  map.addEventListener('pointerleave', () => setNear(undefined));

  map.addEventListener('click', (event) => {
    const link =
      (event.target as Element).closest<SVGAElement>('a[data-province]') ?? canarianAt(event.clientX, event.clientY);
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
