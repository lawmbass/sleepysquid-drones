import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import DarkModeToggle from './DarkModeToggle';

const LOGIN_HREF = process.env.NEXT_PUBLIC_LOGIN_URL || '/login?from=drones';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // The header always uses the site's theme surfaces: white with dark text and blue
  // accents in light mode, dark gray in dark mode. It no longer goes transparent over
  // the (always dark) hero, which is what kept it dark navy in light mode.
  const link = 'text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400 transition-colors';
  const loginBtn = 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:border-gray-600';

  return (
    <nav className={`fixed w-full z-40 transition-all duration-300 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 ${scrolled || isOpen ? 'shadow-sm py-2' : 'py-3'}`} style={{ top: 'var(--promo-banner-height, 0px)' }}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity" aria-label="SleepySquid Drones home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-dark.svg" alt="SleepySquid Drones" className="h-12 md:h-16 w-auto hidden dark:block" width="159" height="64" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-light.svg" alt="" aria-hidden="true" className="h-12 md:h-16 w-auto block dark:hidden" width="159" height="64" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className={link}>
              Home
            </Link>
            <Link href="/#services" className={link}>
              Services
            </Link>
            <Link href="/#portfolio" className={link}>
              Portfolio
            </Link>
            <Link href="/#pricing" className={link}>
              Pricing
            </Link>
            <Link href="/#contact" className={link}>
              Contact
            </Link>
            <Link href="/#booking" className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full transition-colors">
              Book Now
            </Link>
            <Link href={LOGIN_HREF} className={`${loginBtn} px-5 py-2 rounded-full transition-colors`}>
              Login
            </Link>
            <DarkModeToggle />
          </div>

          {/* Mobile Menu Button and Dark Mode Toggle */}
          <div className="md:hidden flex items-center space-x-3">
            <DarkModeToggle />
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 focus:outline-none"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <motion.div 
        initial={{ opacity: 0, height: 0 }}
        animate={{ 
          opacity: isOpen ? 1 : 0,
          height: isOpen ? 'auto' : 0
        }}
        transition={{ duration: 0.3 }}
        className="md:hidden overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800"
      >
        <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
          <Link href="/" className={`${link} py-2`} onClick={() => setIsOpen(false)}>
            Home
          </Link>
          <Link href="/#services" className={`${link} py-2`} onClick={() => setIsOpen(false)}>
            Services
          </Link>
          <Link href="/#portfolio" className={`${link} py-2`} onClick={() => setIsOpen(false)}>
            Portfolio
          </Link>
          <Link href="/#pricing" className={`${link} py-2`} onClick={() => setIsOpen(false)}>
            Pricing
          </Link>
          <Link href="/#contact" className={`${link} py-2`} onClick={() => setIsOpen(false)}>
            Contact
          </Link>
          <Link href="/#booking" className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full transition-colors text-center" onClick={() => setIsOpen(false)}>
            Book Now
          </Link>
          <Link href={LOGIN_HREF} className={`${loginBtn} px-5 py-2 rounded-full transition-colors text-center`} onClick={() => setIsOpen(false)}>
            Login
          </Link>
        </div>
      </motion.div>
    </nav>
  );
};

export default Navbar; 