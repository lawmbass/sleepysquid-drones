import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import DroneSquidHero from './DroneSquidHero';

// Illustrated hero: a daytime sky in light mode, a clean night-sky gradient in dark mode (no photo) so the animated squid pilot and
// its drone read clearly, matching the flat brand style of sleepysquid.com and ai.sleepysquid.com.
const HeroSection = () => {
  const reduce = useReducedMotion();
  // useReducedMotion() is null until the media query resolves. Treat that the same as
  // reduced motion so the headline is painted, not left at opacity 0.
  const fade = (delay) =>
    reduce === false
      ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay } }
      : { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } };

  return (
    <section className="dsq-hero relative min-h-screen flex items-center overflow-hidden text-slate-900 dark:text-white">
      <div className="dsq-sky absolute inset-0 z-0" aria-hidden="true" />

      <div className="container mx-auto px-6 md:px-8 relative z-10 pt-28 pb-24 md:py-0">
        <div className="grid md:grid-cols-[1.25fr_1fr] items-center gap-6 md:gap-10">
          <div className="max-w-2xl">
            <motion.p {...fade(0)} className="text-sm font-semibold tracking-wide uppercase text-blue-600 dark:text-sky-300 mb-3">
              Washington, DC, Maryland &amp; Virginia
            </motion.p>
            <motion.h1 {...fade(0.05)} className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5 text-balance">
              Drone Photography &amp; Aerial Video Across Washington, DC, Maryland &amp; Virginia
            </motion.h1>
            <motion.p {...fade(0.2)} className="text-lg md:text-xl text-slate-700 dark:text-slate-200 mb-8 max-w-xl">
              Flyable Maryland &amp; Virginia suburbs, plus authorized operations in Washington, DC.
              <span className="mt-3 block text-sm font-semibold text-blue-700 dark:text-sky-300">
                FAA Part 107 Certified &amp; Insured
                <span className="mt-1 block font-medium text-slate-600 dark:text-slate-300">$1M liability coverage</span>
              </span>
            </motion.p>
            <motion.div {...fade(0.4)} className="flex flex-col sm:flex-row gap-4">
              <Link href="#booking" className="bg-gradient-to-r from-blue-600 to-teal-700 dark:from-blue-500 dark:to-teal-400 text-white px-8 py-3 rounded-full font-medium text-lg hover:shadow-lg transition-all text-center">
                Book a Service
              </Link>
              <Link href="#services" className="bg-transparent border-2 border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white dark:border-white/80 dark:text-white px-8 py-3 rounded-full font-medium text-lg dark:hover:bg-white dark:hover:text-gray-900 transition-all text-center">
                Explore Services
              </Link>
            </motion.div>
          </div>
          <DroneSquidHero />
        </div>
      </div>

      <motion.div
        className="absolute bottom-6 left-0 right-0 hidden md:flex justify-center"
        animate={reduce ? undefined : { y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <div className="flex flex-col items-center text-slate-600 dark:text-white/80">
          <span className="text-sm mb-2 text-center">Scroll Down</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
