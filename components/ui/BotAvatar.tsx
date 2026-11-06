'use client';

/**
 * Flat (SVG) version of a bot for sheets and panels: a soft, round chalk head with an ink face
 * screen, eyes in the agent color, a mic headset and a round body.
 *
 * Expressions morph smoothly (the same shapes animate between states, nothing pops in):
 * - idle: open eyes, small smile, blinks now and then
 * - thinking: reads a page, eyes look down and scan, antenna pulses
 * - searching: sweeps a magnifying glass, eyes follow it
 * - happy: smiling eyes, bigger smile, rosy cheeks, a little wave
 * - excited: both hands up, big smile, sparkles, a happy hop
 * - embarrassed: deep blush, eyes look away, hand behind the head, a sweat drop
 * - sad: apologetic, never cross: brows lift in the middle, eyes look down, hands together
 */
import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';

export type BotMood = 'idle' | 'thinking' | 'searching' | 'happy' | 'excited' | 'embarrassed' | 'sad';

const INK = '#191719';

type Pose = {
  eyeX: number;
  eyeY: number;
  eyeRy: number;
  lowerLid: number; // cy of the lower lid; lower value = smiling eyes
  brows: number;
  mouth: string;
  cheeks: number;
  tilt: number;
  handL: [number, number];
  handR: [number, number];
};

const POSES: Record<BotMood, Pose> = {
  idle: {
    eyeX: 0,
    eyeY: 59,
    eyeRy: 9,
    lowerLid: 84,
    brows: 0,
    mouth: 'M53 73 Q60 77.5 67 73',
    cheeks: 0,
    tilt: 0,
    handL: [24, 118],
    handR: [96, 118],
  },
  thinking: {
    eyeX: 0,
    eyeY: 63,
    eyeRy: 7,
    lowerLid: 84,
    brows: 0,
    mouth: 'M55 74 Q60 75.5 65 74',
    cheeks: 0,
    tilt: 4,
    handL: [38, 118],
    handR: [82, 113],
  },
  searching: {
    eyeX: 3,
    eyeY: 58,
    eyeRy: 9.5,
    lowerLid: 84,
    brows: 0,
    mouth: 'M55 74 Q60 76 65 74',
    cheeks: 0,
    tilt: 3,
    handL: [26, 118],
    handR: [98, 100],
  },
  happy: {
    eyeX: 0,
    eyeY: 58,
    eyeRy: 9,
    lowerLid: 67,
    brows: 0,
    mouth: 'M51 71 Q60 80 69 71',
    cheeks: 0.55,
    tilt: -2,
    handL: [24, 118],
    handR: [97, 100],
  },
  excited: {
    eyeX: 0,
    eyeY: 57,
    eyeRy: 10,
    lowerLid: 66,
    brows: 0,
    mouth: 'M49 70 Q60 84 71 70',
    cheeks: 0.7,
    tilt: 0,
    handL: [18, 92],
    handR: [102, 92],
  },
  embarrassed: {
    eyeX: -6,
    eyeY: 62,
    eyeRy: 6.5,
    lowerLid: 84,
    brows: 0,
    mouth: 'M53 75 Q56.5 72.5 60 75 Q63.5 77.5 67 75',
    cheeks: 1,
    tilt: -7,
    handL: [52, 122],
    handR: [104, 60],
  },
  sad: {
    eyeX: 0,
    eyeY: 62,
    eyeRy: 7.5,
    lowerLid: 84,
    brows: 1,
    mouth: 'M54 76 Q60 72.5 66 76',
    cheeks: 0.3,
    tilt: -6,
    handL: [52, 121],
    handR: [68, 121],
  },
};

// The wavy embarrassed mouth has more points; give the others a matching shape so it morphs.
function mouthPath(m: BotMood) {
  const d = POSES[m].mouth;
  if (d.split('Q').length === 3) return d;
  // "Mx y Qcx cy ex ey" → split into two quads with the same curve.
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const [x0, y0, cx, cy, x1, y1] = n as [number, number, number, number, number, number];
  const mx = (x0 + 2 * cx + x1) / 4;
  const my = (y0 + 2 * cy + y1) / 4;
  return `M${x0} ${y0} Q${(x0 + cx) / 2} ${(y0 + cy) / 2} ${mx} ${my} Q${(cx + x1) / 2} ${(cy + y1) / 2} ${x1} ${y1}`;
}

const SOFT: Transition = { type: 'spring', stiffness: 170, damping: 22, mass: 0.9 };

export function BotAvatar({
  color,
  mood,
  size = 120,
  label,
}: {
  color: string;
  mood: BotMood;
  size?: number;
  /** Screen reader label, e.g. "Concierge, thinking". */
  label: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId().replace(/:/g, '');
  const pose = POSES[mood];
  const thinking = mood === 'thinking';
  const searching = mood === 'searching';
  const excited = mood === 'excited';
  const t: Transition = reduced ? { duration: 0 } : SOFT;
  const loop = (duration: number): Transition =>
    reduced ? { duration: 0 } : { duration, repeat: Infinity, ease: 'easeInOut' };
  const blink = useBlink(!reduced && (mood === 'idle' || mood === 'happy' || searching));

  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 120 144"
      role="img"
      aria-label={label}
      overflow="visible"
    >
      <defs>
        <radialGradient id={`head-${uid}`} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="75%" stopColor="#f3f0ea" />
          <stop offset="100%" stopColor="#e2ddd4" />
        </radialGradient>
        <radialGradient id={`body-${uid}`} cx="40%" cy="25%" r="85%">
          <stop offset="0%" stopColor={color} stopOpacity="0.75" />
          <stop offset="55%" stopColor={color} />
        </radialGradient>
        <clipPath id={`screen-${uid}`}>
          <rect x="25" y="36" width="70" height="46" rx="21" />
        </clipPath>
      </defs>

      {/* Soft ground shadow */}
      <ellipse cx="60" cy="139" rx="30" ry="4" fill="#000" opacity="0.12" />

      {/* Bob: a calm breath, or a hop when excited */}
      <motion.g
        animate={reduced ? {} : excited ? { y: [0, -9, 0] } : { y: [0, -2, 0] }}
        transition={excited ? loop(0.55) : loop(3.2)}
      >
        {/* Sparkles when excited */}
        <motion.g
          initial={false}
          animate={{ opacity: excited ? 1 : 0, scale: excited ? 1 : 0.6 }}
          transition={t}
          style={{ originX: '60px', originY: '50px' }}
          fill={color}
        >
          {[
            [8, 26, 1],
            [110, 22, 0.8],
            [116, 78, 0.6],
            [2, 80, 0.7],
          ].map(([x, y, s], i) => (
            <motion.path
              key={i}
              d={`M${x} ${y! - 6 * s!} L${x! + 1.6 * s!} ${y! - 1.6 * s!} L${x! + 6 * s!} ${y} L${x! + 1.6 * s!} ${y! + 1.6 * s!} L${x} ${y! + 6 * s!} L${x! - 1.6 * s!} ${y! + 1.6 * s!} L${x! - 6 * s!} ${y} L${x! - 1.6 * s!} ${y! - 1.6 * s!} Z`}
              animate={excited && !reduced ? { opacity: [0.3, 1, 0.3] } : {}}
              transition={excited && !reduced ? { duration: 0.9, repeat: Infinity, delay: i * 0.2 } : {}}
            />
          ))}
        </motion.g>

        {/* Body */}
        <rect x="33" y="98" width="54" height="38" rx="19" fill={`url(#body-${uid})`} />
        <circle cx="60" cy="114" r="3.5" fill="#ffffff" opacity="0.85" />

        {/* Page (thinking) sits behind the hands */}
        <motion.g
          initial={false}
          animate={{ opacity: thinking ? 1 : 0, y: thinking ? 0 : 10 }}
          transition={reduced ? { duration: 0 } : { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <g transform="rotate(-7 60 116)">
            <rect x="40" y="99" width="40" height="32" rx="6" fill="#ffffff" stroke="#e3dfd9" />
            {[107, 114, 121].map((y, i) => (
              <rect key={y} x="46" y={y} width={i === 2 ? 17 : 28} height="3" rx="1.5" fill="#c9c4c0" />
            ))}
          </g>
        </motion.g>

        {/* Hands */}
        <motion.circle
          r="7"
          fill={color}
          initial={false}
          animate={
            excited && !reduced
              ? { cx: pose.handL[0], cy: [pose.handL[1], pose.handL[1] - 5, pose.handL[1]] }
              : { cx: pose.handL[0], cy: pose.handL[1] }
          }
          transition={excited && !reduced ? { cx: SOFT, cy: { duration: 0.55, repeat: Infinity } } : t}
        />
        <motion.g
          initial={false}
          animate={
            searching && !reduced
              ? { x: [pose.handR[0] - 4, pose.handR[0] + 4, pose.handR[0] - 4], y: pose.handR[1] }
              : mood === 'happy' && !reduced
                ? { x: pose.handR[0], y: [pose.handR[1], pose.handR[1] - 6, pose.handR[1]] }
                : excited && !reduced
                  ? { x: pose.handR[0], y: [pose.handR[1], pose.handR[1] - 5, pose.handR[1]] }
                  : { x: pose.handR[0], y: pose.handR[1] }
          }
          transition={
            searching && !reduced
              ? { x: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, y: SOFT }
              : (mood === 'happy' || excited) && !reduced
                ? { x: SOFT, y: { duration: mood === 'happy' ? 0.9 : 0.55, repeat: Infinity } }
                : t
          }
        >
          {/* Magnifying glass (searching) */}
          <motion.g
            initial={false}
            animate={{ opacity: searching ? 1 : 0, scale: searching ? 1 : 0.5 }}
            transition={t}
          >
            <line x1="4" y1="-4" x2="12" y2="-16" stroke={INK} strokeWidth="4" strokeLinecap="round" />
            <circle cx="16" cy="-22" r="9" fill="#e7f6f8" fillOpacity="0.85" stroke={INK} strokeWidth="3.5" />
            <circle cx="13" cy="-25" r="2.5" fill="#ffffff" />
          </motion.g>
          <circle r="7" fill={color} />
        </motion.g>

        {/* Head group tilts with the mood */}
        <motion.g
          style={{ originX: '60px', originY: '98px' }}
          initial={false}
          animate={{ rotate: pose.tilt }}
          transition={t}
        >
          {/* Antenna */}
          <path d="M60 23 L60 11" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <motion.circle
            cx="60"
            cy="9"
            r="5.5"
            fill={color}
            animate={(thinking || searching) && !reduced ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={(thinking || searching) && !reduced ? loop(1) : { duration: 0.2 }}
          />

          {/* Head and face screen */}
          <rect x="12" y="22" width="96" height="76" rx="36" fill={`url(#head-${uid})`} />
          <rect x="25" y="36" width="70" height="46" rx="21" fill={INK} />

          {/* Headset */}
          <path
            d="M11 58 C11 12 109 12 109 58"
            fill="none"
            stroke={INK}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <rect x="5" y="47" width="12" height="24" rx="6" fill={INK} />
          <rect x="103" y="47" width="12" height="24" rx="6" fill={INK} />
          <rect x="2" y="52" width="4" height="14" rx="2" fill={color} />
          <rect x="114" y="52" width="4" height="14" rx="2" fill={color} />
          <path
            d="M109 69 C111 86 100 93 87 92"
            fill="none"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="86" cy="92" r="4" fill={color} />

          {/* Sweat drop (embarrassed) */}
          <motion.path
            d="M100 30 Q104 37 100 40 Q96 37 100 30 Z"
            fill="#9fd8e3"
            initial={false}
            animate={{ opacity: mood === 'embarrassed' ? 1 : 0, y: mood === 'embarrassed' ? 0 : -6 }}
            transition={t}
          />

          {/* Face, clipped to the screen so lids and blinks stay inside */}
          <g clipPath={`url(#screen-${uid})`}>
            <motion.ellipse
              cx="35"
              cy="72"
              rx="7"
              ry="4"
              fill="#f25c8a"
              initial={false}
              animate={{ opacity: pose.cheeks }}
              transition={t}
            />
            <motion.ellipse
              cx="85"
              cy="72"
              rx="7"
              ry="4"
              fill="#f25c8a"
              initial={false}
              animate={{ opacity: pose.cheeks }}
              transition={t}
            />

            {/* Eyes: scan while reading/searching, glance away when embarrassed */}
            <motion.g
              initial={false}
              animate={
                (thinking || searching) && !reduced
                  ? { x: [-4 + pose.eyeX, 4 + pose.eyeX, -4 + pose.eyeX] }
                  : { x: pose.eyeX }
              }
              transition={(thinking || searching) && !reduced ? loop(searching ? 1.6 : 1.8) : t}
            >
              {[46, 74].map((cx) => (
                <motion.ellipse
                  key={cx}
                  cx={cx}
                  rx="6.5"
                  fill={color}
                  initial={false}
                  animate={{ cy: pose.eyeY, ry: blink ? 0.8 : pose.eyeRy }}
                  transition={blink ? { duration: 0.08 } : t}
                />
              ))}
              {/* Eye shine */}
              {[48, 76].map((cx) => (
                <motion.circle
                  key={`s${cx}`}
                  cx={cx}
                  r="1.8"
                  fill="#ffffff"
                  initial={false}
                  animate={{ cy: pose.eyeY - 3, opacity: blink ? 0 : 0.85 }}
                  transition={t}
                />
              ))}
              {/* Lower lids rise for smiling eyes */}
              {[46, 74].map((cx) => (
                <motion.ellipse
                  key={`lid${cx}`}
                  cx={cx}
                  rx="11"
                  ry="8"
                  fill={INK}
                  initial={false}
                  animate={{ cy: pose.lowerLid }}
                  transition={t}
                />
              ))}
            </motion.g>

            {/* Apologetic brows: raised in the middle */}
            <motion.g
              initial={false}
              animate={{ opacity: pose.brows }}
              transition={t}
              fill="none"
              stroke={color}
              strokeWidth="2.6"
              strokeLinecap="round"
            >
              <path d="M39 50 Q45 49 51 45" />
              <path d="M81 50 Q75 49 69 45" />
            </motion.g>

            {/* Mouth morphs between smile, line, wavy (embarrassed) and a soft frown */}
            <motion.path
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ d: mouthPath(mood) }}
              transition={t}
            />
          </g>
        </motion.g>
      </motion.g>
    </svg>
  );
}

/** Blinks every 2.8–5.5 s while enabled. */
function useBlink(enabled: boolean) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let a = 0;
    let b = 0;
    const schedule = () => {
      a = window.setTimeout(
        () => {
          setBlink(true);
          b = window.setTimeout(() => {
            setBlink(false);
            schedule();
          }, 130);
        },
        2800 + Math.random() * 2700,
      );
    };
    schedule();
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [enabled]);
  return enabled && blink;
}
