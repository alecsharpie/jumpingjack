import { FilesetResolver, PoseLandmarker, GestureRecognizer } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODELS = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};
const GESTURE_MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

let fileset;
const getFileset = () => (fileset ??= FilesetResolver.forVisionTasks(WASM));

// Tries the GPU first and falls back to the CPU.
async function create(Task, options) {
  const fs = await getFileset();
  try {
    return await Task.createFromOptions(fs, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } });
  } catch (err) {
    console.warn('GPU delegate failed, falling back to CPU', err);
    return await Task.createFromOptions(fs, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
}

export function createPoseDetector(model = 'full', numPoses = 2) {
  return create(PoseLandmarker, {
    baseOptions: { modelAssetPath: POSE_MODELS[model] || POSE_MODELS.full },
    runningMode: 'VIDEO',
    numPoses,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export function createGestureRecognizer(numHands = 4) {
  return create(GestureRecognizer, {
    baseOptions: { modelAssetPath: GESTURE_MODEL },
    runningMode: 'VIDEO',
    numHands,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}
