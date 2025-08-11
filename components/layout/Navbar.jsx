import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import DarkModeToggle from './DarkModeToggle';

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

  return (
    <nav className={`fixed w-full z-40 transition-all duration-300 ${scrolled ? 'bg-teal-900/90 dark:bg-gray-900/95 backdrop-blur-sm py-2 shadow-lg' : 'bg-gradient-to-b from-black/40 to-transparent dark:from-gray-900/50 dark:to-transparent py-4'}`} style={{ top: 'var(--promo-banner-height, 0px)' }}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-white hover:text-blue-300 transition-colors">
            SleepySquid Drones
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-white hover:text-blue-300 transition-colors">
              Home
            </Link>
            <Link href="#services" className="text-white hover:text-blue-300 transition-colors">
              Services
            </Link>
            <Link href="#portfolio" className="text-white hover:text-blue-300 transition-colors">
              Portfolio
            </Link>
            <Link href="#pricing" className="text-white hover:text-blue-300 transition-colors">
              Pricing
            </Link>
            <Link href="#contact" className="text-white hover:text-blue-300 transition-colors">
              Contact
            </Link>
            <Link href="#booking" className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full transition-colors">
              Book Now
            </Link>
            <Link href="/login" className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-full transition-colors border border-gray-600">
              Login
            </Link>
            <DarkModeToggle />
          </div>

          {/* Mobile Menu Button and Dark Mode Toggle */}
          <div className="md:hidden flex items-center space-x-3">
            <DarkModeToggle />
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-white focus:outline-none"
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
        className="md:hidden overflow-hidden bg-teal-900/95 dark:bg-gray-900/95 backdrop-blur-sm"
      >
        <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
          <Link href="/" className="text-white hover:text-blue-300 transition-colors py-2" onClick={() => setIsOpen(false)}>
            Home
          </Link>
          <Link href="#services" className="text-white hover:text-blue-300 transition-colors py-2" onClick={() => setIsOpen(false)}>
            Services
          </Link>
          <Link href="#portfolio" className="text-white hover:text-blue-300 transition-colors py-2" onClick={() => setIsOpen(false)}>
            Portfolio
          </Link>
          <Link href="#pricing" className="text-white hover:text-blue-300 transition-colors py-2" onClick={() => setIsOpen(false)}>
            Pricing
          </Link>
          <Link href="#contact" className="text-white hover:text-blue-300 transition-colors py-2" onClick={() => setIsOpen(false)}>
            Contact
          </Link>
          <Link href="#booking" className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full transition-colors text-center" onClick={() => setIsOpen(false)}>
            Book Now
          </Link>
          <Link href="/login" className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-full transition-colors text-center border border-gray-600" onClick={() => setIsOpen(false)}>
            Login
          </Link>
        </div>
      </motion.div>
    </nav>
  );
};

export default Navbar; 