'use client';

import { useRef, useState, type ReactNode } from 'react';
import { motion, useInView, type Transition, type UseInViewOptions, type Variant } from 'motion/react';

type InViewProps = {
  children: ReactNode;
  className?: string;
  variants?: { hidden: Variant; visible: Variant };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  once?: boolean;
};

const defaultVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

/** Motion Primitives' viewport reveal, kept local so Luminails can tune its rhythm. */
export function InView({
  children,
  className,
  variants = defaultVariants,
  transition = { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  viewOptions = { amount: 0.18, margin: '0px 0px -8% 0px' },
  once = true,
}: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, viewOptions);
  const [hasViewed, setHasViewed] = useState(false);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView || hasViewed ? 'visible' : 'hidden'}
      variants={variants}
      transition={transition}
      onAnimationComplete={() => {
        if (once) setHasViewed(true);
      }}
    >
      {children}
    </motion.div>
  );
}
