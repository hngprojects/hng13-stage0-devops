// Run with: node generate-icons.js
// Requires: npm install canvas
const { createCanvas } = require('canvas');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 192, 512];

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2;

  // Background gradient
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  bg.addColorStop(0, '#1C1C3A');
  bg.addColorStop(1, '#0D0D1A');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  const ring = ctx.createLinearGradient(0, 0, size, size);
  ring.addColorStop(0, '#7C3AED');
  ring.addColorStop(1, '#A855F7');
  ctx.strokeStyle = ring;
  ctx.lineWidth = size * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r - size * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  // Clock hands
  const clockR = r * 0.55;
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = size * 0.035;
  ctx.lineCap = 'round';

  // Hour hand (pointing to ~10)
  const hAngle = (-60) * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hAngle) * clockR * 0.6, cy + Math.sin(hAngle) * clockR * 0.6);
  ctx.stroke();

  // Minute hand (pointing to ~2)
  const mAngle = (60) * Math.PI / 180;
  ctx.lineWidth = size * 0.025;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(mAngle) * clockR * 0.85, cy + Math.sin(mAngle) * clockR * 0.85);
  ctx.stroke();

  // Second hand
  const sAngle = (-30) * Math.PI / 180;
  ctx.strokeStyle = '#A855F7';
  ctx.lineWidth = size * 0.015;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sAngle) * clockR * 0.9, cy + Math.sin(sAngle) * clockR * 0.9);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = '#A855F7';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  fs.writeFileSync(`icons/icon-${size}.png`, canvas.toBuffer('image/png'));
  console.log(`Generated icon-${size}.png`);
});
