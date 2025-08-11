import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

const HeroSection = () => {
  return (
    <div className="relative h-screen flex items-center overflow-hidden">
      {/* Background Video or Image */}
      <div className="absolute inset-0 z-0" style={{ top: '0' }}>
        {/* If you have a video, use this: */}
        {/* <video
          autoPlay
          loop
          muted
          className="object-cover w-full h-full"
          poster="/images/drone-poster.jpg"
        >
          <source src="/videos/drone-footage.mp4" type="video/mp4" />
        </video> */}
        
        {/* If using an image instead of video: */}
        <Image 
          src="https://images.unsplash.com/photo-1506947411487-a56738267384?q=80&w=2670&auto=format&fit=crop"
          alt="Drone flying over landscape"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60 dark:from-gray-900/70 dark:via-gray-900/50 dark:to-gray-900/70"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 z-10 text-white">
        <div className="max-w-3xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold mb-4"
          >
            Elevate Your Perspective with SleepySquid Drones
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl mb-8"
          >
            Stunning aerial photography, videography, and specialized drone solutions for your unique needs
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link href="#booking" className="bg-gradient-to-r from-blue-500 to-teal-400 text-white px-8 py-3 rounded-full font-medium text-lg hover:shadow-lg transition-all text-center">
              Book a Service
            </Link>
            <Link href="#services" className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-full font-medium text-lg hover:bg-white hover:text-gray-900 dark:hover:text-gray-800 transition-all text-center">
              Explore Services
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Scroll Down Indicator */}
      <motion.div 
        className="absolute bottom-8 left-0 right-0 flex justify-center"
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <div className="flex flex-col items-center text-white">
          <span className="text-sm mb-2 text-center">Scroll Down</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
            <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </motion.div>
    </div>
  );
};

export default HeroSection; 