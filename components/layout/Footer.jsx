import React from 'react';
import Link from 'next/link';
import { FiMapPin, FiPhone, FiMail, FiFacebook, FiInstagram, FiYoutube, FiTwitter } from 'react-icons/fi';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">SleepySquid Drones</h3>
            <p className="text-gray-400 mb-4">
              Professional drone services for photography, videography, mapping, and more. Elevating perspectives since 2020.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FiFacebook size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FiInstagram size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FiYoutube size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <FiTwitter size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
              </li>
              <li>
                <Link href="#services" className="text-gray-400 hover:text-white transition-colors">Services</Link>
              </li>
              <li>
                <Link href="#portfolio" className="text-gray-400 hover:text-white transition-colors">Portfolio</Link>
              </li>
              <li>
                <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</Link>
              </li>
              <li>
                <Link href="#contact" className="text-gray-400 hover:text-white transition-colors">Contact</Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Our Services</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#services" className="text-gray-400 hover:text-white transition-colors">Aerial Photography</Link>
              </li>
              <li>
                <Link href="#services" className="text-gray-400 hover:text-white transition-colors">Drone Videography</Link>
              </li>
              <li>
                <Link href="#services" className="text-gray-400 hover:text-white transition-colors">Mapping & Surveying</Link>
              </li>
              <li>
                <Link href="#services" className="text-gray-400 hover:text-white transition-colors">Real Estate Tours</Link>
              </li>
              <li>
                <Link href="#services" className="text-gray-400 hover:text-white transition-colors">Inspection Services</Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center">
                <FiPhone className="text-blue-400 mr-3" />
                <span className="text-gray-400">(123) 456-7890</span>
              </li>
              <li className="flex items-center">
                <FiMail className="text-blue-400 mr-3" />
                <span className="text-gray-400">info@sleepysquid.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
          <p>&copy; {currentYear} SleepySquid Drones. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 