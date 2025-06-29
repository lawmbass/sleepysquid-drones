import React from 'react';
import { motion } from 'framer-motion';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useDarkMode } from './DarkModeContext';

const DarkModeToggle = ({ className = '' }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative inline-flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
        isDarkMode 
          ? 'bg-blue-600 hover:bg-blue-700' 
          : 'bg-gray-300 hover:bg-gray-400'
      } ${className}`}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      {/* Track */}
      <div className="absolute inset-0 rounded-full" />
      
      {/* Slider with icon */}
      <motion.div
        className={`absolute flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-colors duration-300 ${
          isDarkMode 
            ? 'bg-white text-blue-600' 
            : 'bg-white text-orange-500'
        }`}
        animate={{
          x: isDarkMode ? 16 : -16,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      >
        {isDarkMode ? (
          <FiMoon className="h-4 w-4" />
        ) : (
          <FiSun className="h-4 w-4" />
        )}
      </motion.div>
      
      {/* Background icons for context */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5">
        <FiSun className={`h-3 w-3 transition-opacity duration-300 ${
          isDarkMode ? 'opacity-40' : 'opacity-0'
        } text-blue-200`} />
        <FiMoon className={`h-3 w-3 transition-opacity duration-300 ${
          isDarkMode ? 'opacity-0' : 'opacity-40'
        } text-gray-600`} />
      </div>
    </button>
  );
};

export default DarkModeToggle; 