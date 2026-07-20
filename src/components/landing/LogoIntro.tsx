import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const frames = [
  '/tflow_1.png',
  '/tflow_2.png',
  '/tflow_3.png',
  '/tflow_4.png',
  '/tflow_5.png',
  '/tflow_6.png',
  '/tflow_7.png',
  '/tflow_8.png',
  '/tflow_9.png',
];

const bgColors = [
  '#000000',
  '#0a0a0a',
  '#1a0000',
  '#2a0000',
  '#3a0000',
  '#1a0000',
  '#000000',
  '#111111',
  '#0a0a0a',
];

export default function LogoIntroAnimation({ onComplete }: { onComplete?: () => void }) {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentFrame < frames.length - 1) {
        setCurrentFrame(currentFrame + 1);
      } else {
        setTimeout(() => onComplete?.(), 1200);
      }
    }, currentFrame === 0 ? 900 : currentFrame === 1 ? 700 : 480);

    return () => clearTimeout(timeout);
  }, [currentFrame, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      animate={{ backgroundColor: bgColors[currentFrame] }}
      transition={{ duration: 0.6 }}
    >
      <div className="relative w-full max-w-3xl px-6">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentFrame}
            src={frames[currentFrame]}
            alt={`T-FLOW Animation ${currentFrame + 1}`}
            className="w-full h-auto drop-shadow-2xl"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </AnimatePresence>

        <div className="absolute -bottom-12 left-1/2 flex gap-2">
          {frames.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentFrame ? 'bg-red-500 scale-125' : 'bg-red-500/30'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
