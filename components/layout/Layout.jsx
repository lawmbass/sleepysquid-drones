import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { motion } from 'framer-motion';
import { PromoBannerProvider, usePromoBanner } from './PromoBannerContext';

const LayoutContent = ({ children }) => {
  const { isPromoBannerVisible, promoBannerHeight } = usePromoBanner();
  
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <Navbar />
      <main 
        className="flex-grow transition-all duration-300"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {children}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

const Layout = ({ children }) => {
  return (
    <PromoBannerProvider>
      <LayoutContent>{children}</LayoutContent>
    </PromoBannerProvider>
  );
};

export default Layout; 