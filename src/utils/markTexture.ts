/**
 * The shipped CAHEN mark is a dark blue chrome. Built from particles as-is it
 * nearly disappears on the indigo plate, so the asset is remapped once into the
 * studio's violet ramp (deep indigo → lilac → porcelain highlights) before it is
 * handed to the particle system.
 */
const STOPS: ReadonlyArray<readonly [number, readonly [number, number, number]]> = [
  [0, [22, 16, 58]],
  [0.26, [64, 42, 158]],
  [0.52, [124, 88, 240]],
  [0.76, [176, 143, 255]],
  [0.92, [214, 196, 255]],
  [1, [246, 241, 255]],
];

const cache = new Map<string, Promise<string>>();

function sampleRamp(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i += 1) {
    const [stopT, stopColor] = STOPS[i];
    const [prevT, prevColor] = STOPS[i - 1];
    if (t <= stopT) {
      const span = Math.max(stopT - prevT, 0.0001);
      const k = (t - prevT) / span;
      return [
        Math.round(prevColor[0] + (stopColor[0] - prevColor[0]) * k),
        Math.round(prevColor[1] + (stopColor[1] - prevColor[1]) * k),
        Math.round(prevColor[2] + (stopColor[2] - prevColor[2]) * k),
      ];
    }
  }
  return [246, 241, 255];
}

export function violetMarkTexture(src: string, maxSize = 520): Promise<string> {
  const key = `${src}@${maxSize}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const task = (async () => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("mark texture failed to load"));
      if (image.complete && image.naturalWidth > 0) resolve();
    });

    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas 2d unavailable");

    context.drawImage(image, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    const { data } = frame;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const [r, g, b] = sampleRamp(luminance);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    context.putImageData(frame, 0, 0);
    return canvas.toDataURL("image/png");
  })();

  cache.set(key, task);
  task.catch(() => cache.delete(key));
  return task;
}
