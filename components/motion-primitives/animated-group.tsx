'use client';

import { Children, type ReactNode } from 'react';
import { motion, type Variants } from 'motion/react';

type AnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  preset?: 'fade' | 'slide' | 'scale' | 'blur-slide';
};

const presets: Record<NonNullable<AnimatedGroupProps['preset']>, Variants> = {
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.96 }, visible: { opacity: 1, scale: 1 } },
  'blur-slide': {
    hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  },
};

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.085, delayChildren: 0.08 } },
};

/** A compact, copy-pasteable Motion Primitives-style staggered group. */
export function AnimatedGroup({ children, className, preset = 'slide' }: AnimatedGroupProps) {
  const itemVariants = presets[preset];

  return (
    <motion.div className={className} initial="hidden" animate="visible" variants={containerVariants}>
      {Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
