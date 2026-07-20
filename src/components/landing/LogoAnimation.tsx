import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function LogoIntroAnimation({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step < 8) {
        setStep(step + 1);
      } else {
        onComplete?.();
      }
    }, step === 0 ? 800 : step === 1 ? 600 : 500);

    return () => clearTimeout(timer);
  }, [step, onComplete]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
      <div className="relative w-[600px] h-[400px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {/* Step 1-2: Neon T */}
          {step <= 2 && (
            <motion.div
              key="neon-t"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute"
            >
              <div className="text-[280px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-red-500 via-red-600 to-orange-500 drop-shadow-[0_0_60px_#ef4444]">
                T
              </div>
              <div className="absolute inset-0 bg-red-500/30 blur-3xl -z-10" />
            </motion.div>
          )}

          {/* Step 3-6: Cheetah + T */}
          {step >= 3 && step <= 6 && (
            <motion.div
              key="cheetah"
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="relative"
            >
              <img
                src="/logo.png"
                alt="T-FLOW Logo"
                className="w-[520px] drop-shadow-2xl"
              />
              <motion.div
                animate={{ x: [0, 15, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="absolute -bottom-6 right-12 text-6xl"
              >
                📦
              </motion.div>
            </motion.div>
          )}

          {/* Final Logo + Text */}
          {step >= 7 && (
            <motion.div
              key="full-logo"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="text-center"
            >
              <img
                src="/logo.png"
                alt="T-FLOW"
                className="w-[520px] mx-auto drop-shadow-2xl"
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 text-2xl font-medium tracking-widest text-red-500"
              >
                FAST. SMART. DELIVERED.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Red particle background effect */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#ef444420_1px,transparent_1px)] bg-[length:40px_40px]" />
      </div>
    </div>
  );
}
