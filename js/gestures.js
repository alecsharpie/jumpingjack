// Helpers for MediaPipe's gesture recogniser output.
export const GESTURES = {
  Closed_Fist: { emoji: '✊', name: 'FIST' },
  Open_Palm: { emoji: '✋', name: 'OPEN HAND' },
  Victory: { emoji: '✌️', name: 'PEACE' },
  Pointing_Up: { emoji: '☝️', name: 'POINT UP' },
  Thumb_Up: { emoji: '👍', name: 'THUMBS UP' },
  Thumb_Down: { emoji: '👎', name: 'THUMBS DOWN' },
  ILoveYou: { emoji: '🤟', name: 'ROCK ON' },
};

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

// Converts a recogniser result into screen-space hands: { pts, x, y, size, gesture, score }.
export function toHands(res, G) {
  return (res.landmarks || []).map((lms, i) => {
    const pts = lms.map((l) => G.toScreen(l));
    const palm = [0, 5, 9, 13, 17];
    const x = palm.reduce((s, j) => s + pts[j].x, 0) / palm.length;
    const y = palm.reduce((s, j) => s + pts[j].y, 0) / palm.length;
    const size = Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y);
    const top = res.gestures?.[i]?.[0];
    const gesture = top && top.score > 0.5 && GESTURES[top.categoryName] ? top.categoryName : 'None';
    return { pts, x, y, size, gesture, score: top?.score ?? 0 };
  });
}

export function drawHand(ctx, h, color = '#ffcc00', { label = true } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, h.size * 0.08);
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    ctx.moveTo(h.pts[a].x, h.pts[a].y);
    ctx.lineTo(h.pts[b].x, h.pts[b].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  for (const p of h.pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2.5, h.size * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }
  if (label && h.gesture !== 'None') {
    const top = Math.min(...h.pts.map((p) => p.y));
    const s = Math.max(36, h.size * 0.9);
    ctx.font = `${s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(GESTURES[h.gesture].emoji, h.x, top - 8);
  }
  ctx.restore();
}
