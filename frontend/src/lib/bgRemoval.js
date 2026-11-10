import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

const MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
let segmenter = null;

async function getSegmenter() {
  if (segmenter) return segmenter;
  const files = await FilesetResolver.forVisionTasks(`${window.location.origin}/mediapipe`);
  segmenter = await ImageSegmenter.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
    runningMode: "IMAGE", outputCategoryMask: false, outputConfidenceMasks: true,
  });
  return segmenter;
}

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// Runs fully on-device; returns a transparent PNG data URL of the person.
export async function removeBackground(dataUrl) {
  const [img, seg] = await Promise.all([loadImage(dataUrl), getSegmenter()]);
  const result = seg.segment(img);
  const mask = result.confidenceMasks[0];
  const { width: mw, height: mh } = mask;
  const bg = mask.getAsFloat32Array();
  const mc = document.createElement("canvas");
  mc.width = mw; mc.height = mh;
  const mctx = mc.getContext("2d");
  const id = mctx.createImageData(mw, mh);
  for (let i = 0; i < bg.length; i++) {
    const a = Math.min(1, Math.max(0, (1 - bg[i] - 0.25) / 0.5));
    id.data[i * 4 + 3] = Math.round(a * 255);
  }
  mctx.putImageData(id, 0, 0);
  result.close();
  const out = document.createElement("canvas");
  out.width = img.width; out.height = img.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mc, 0, 0, img.width, img.height);
  return out.toDataURL("image/png");
}
