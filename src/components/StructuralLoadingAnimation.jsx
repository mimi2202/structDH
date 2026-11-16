import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const StructuralLoadingAnimation = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (progress < 100) {
        setProgress(prev => Math.min(prev + 1, 100));
      }
    }, 20);
    
    return () => clearTimeout(timer);
  }, [progress]);

  // Particle positions for the blueprint effect
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: i * 0.05,
    size: Math.random() * 4 + 2
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle at center, rgba(10,47,68,0.95) 0%, rgba(10,47,68,1) 100%)',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Blueprint Grid Background */}
      <svg className="absolute inset-0 w-full h-full opacity-10">
        <defs>
          <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cce1eb" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Floating Particles - Engineering Blueprint Style */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: 'radial-gradient(circle, #cce1eb, transparent)',
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15, -15, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 4 + particle.id * 0.1,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Main Container */}
      <div className="relative flex flex-col items-center">
        {/* Animated Structural Lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ transform: 'scale(1.5)' }}>
          <motion.circle
            cx="50%"
            cy="50%"
            r="60"
            stroke="#cce1eb"
            strokeWidth="1"
            strokeDasharray="5,5"
            fill="none"
            initial={{ pathLength: 0, rotate: 0 }}
            animate={{ pathLength: 1, rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r="80"
            stroke="#cce1eb"
            strokeWidth="1"
            strokeDasharray="5,5"
            fill="none"
            initial={{ pathLength: 0, rotate: 180 }}
            animate={{ pathLength: 1, rotate: 540 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />
        </svg>

        {/* Main Logo Container */}
        <motion.div
          className="relative w-40 h-40 mb-8"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Background Glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'radial-gradient(circle, rgba(44,82,130,0.6) 0%, rgba(10,47,68,0) 70%)',
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Logo Box with Structural Reveal */}
          <motion.div
            className="relative w-full h-full bg-[#0A2F44] rounded-2xl flex items-center justify-center overflow-hidden"
            style={{
              boxShadow: '0 0 30px rgba(44,82,130,0.5)',
            }}
          >
            {/* Scanning Line Effect */}
            <motion.div
              className="absolute w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent"
              animate={{
                y: [-80, 80],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear"
              }}
            />

            {/* Animated Structural Grid Overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-30">
              <motion.rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="none"
                stroke="#cce1eb"
                strokeWidth="1"
                strokeDasharray="10,10"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </svg>

            {/* The Logo SDH with Construction Effect */}
            <div className="relative z-10 flex items-center justify-center">
              <motion.span
                className="text-5xl font-bold text-white"
                animate={{
                  textShadow: [
                    '0 0 5px #cce1eb',
                    '0 0 20px #cce1eb',
                    '0 0 5px #cce1eb',
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                S
              </motion.span>
              
              {/* Animated Divider */}
              <motion.div
                className="w-1 h-12 mx-2 bg-white"
                animate={{
                  scaleY: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              <motion.span
                className="text-5xl font-bold text-white"
                animate={{
                  textShadow: [
                    '0 0 5px #cce1eb',
                    '0 0 20px #cce1eb',
                    '0 0 5px #cce1eb',
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.3
                }}
              >
                DH
              </motion.span>
            </div>

            {/* Corner Markers - Engineering Style */}
            {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
              <motion.div
                key={i}
                className={`absolute ${pos} w-6 h-6`}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              >
                <div className={`absolute ${pos.includes('left') ? 'left-0' : 'right-0'} ${pos.includes('top') ? 'top-0' : 'bottom-0'} w-4 h-4 border-2 border-[#cce1eb]`}
                     style={{
                       borderRightWidth: pos.includes('right') ? '2px' : '0',
                       borderLeftWidth: pos.includes('left') ? '2px' : '0',
                       borderTopWidth: pos.includes('top') ? '2px' : '0',
                       borderBottomWidth: pos.includes('bottom') ? '2px' : '0',
                     }}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Loading Text with Typing Effect */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.p
            className="text-xl font-light mb-2"
            style={{ color: '#cce1eb' }}
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {progress < 30 && "Analyzing structural integrity..."}
            {progress >= 30 && progress < 60 && "Loading optimization engine..."}
            {progress >= 60 && progress < 90 && "Calibrating Eurocode compliance..."}
            {progress >= 90 && "Ready for takeoff..."}
          </motion.p>

          {/* Progress Bar - Structural Style */}
          <div className="w-64 h-1 bg-[#1e3a4a] rounded-full overflow-hidden">
            <motion.div
              className="h-full"
              style={{
                background: 'linear-gradient(90deg, #cce1eb, #ffffff)',
                width: `${progress}%`,
              }}
              animate={{
                boxShadow: [
                  '0 0 5px #cce1eb',
                  '0 0 15px #cce1eb',
                  '0 0 5px #cce1eb',
                ],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Loading Percentage - Engineering Style */}
      <motion.div
        className="absolute bottom-12 right-12 text-6xl font-bold opacity-20"
        style={{ color: '#cce1eb' }}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      >
        {progress}%
      </motion.div>
    </motion.div>
  );
};

export default StructuralLoadingAnimation;