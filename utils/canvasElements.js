// Older boards could reuse a numeric ID after erasing an element.
const normalizeElementIds = (elements) => {
  const used = new Set(elements.map(({ id }) => id));
  const seen = new Set();
  return elements.map((element, index) => {
    if (!seen.has(element.id)) {
      seen.add(element.id);
      return element;
    }
    let suffix = index;
    let id = `legacy-${element.id}-${suffix}`;
    while (used.has(id)) id = `legacy-${element.id}-${++suffix}`;
    used.add(id);
    return { ...element, id };
  });
};

const canvasSnapshot = (canvas) => ({
  canvasId: canvas._id.toString(),
  elements: normalizeElementIds(canvas.elements),
  revision: canvas.revision ?? 0,
});

module.exports = { normalizeElementIds, canvasSnapshot };
