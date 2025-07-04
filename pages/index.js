import { useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import HeroSection from '@/components/home/HeroSection';
import ServicesSection from '@/components/home/ServicesSection';
import PortfolioSection from '@/components/home/PortfolioSection';
import PricingSection from '@/components/home/PricingSection';
import BookingSection from '@/components/home/BookingSection';
import ContactSection from '@/components/home/ContactSection';

export default function Home() {
  const [selectedService, setSelectedService] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');

  const handleServiceSelect = (serviceId) => {
    setSelectedService(serviceId);
    setSelectedPackage(''); // Clear package when selecting individual service
    // Scroll to booking section
    setTimeout(() => {
      const bookingSection = document.getElementById('booking');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handlePackageSelect = (serviceId, packageId) => {
    setSelectedService(serviceId);
    setSelectedPackage(packageId);
    // Scroll to booking section
    setTimeout(() => {
      const bookingSection = document.getElementById('booking');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <>
      <Head>
        <title>SleepySquid Drones | Professional Drone Services</title>
        <meta name="description" content="Professional drone services including aerial photography, videography, mapping, and more. Elevate your perspective with SleepySquid Drones." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <Layout>
        <HeroSection />
        <ServicesSection onServiceSelect={handleServiceSelect} />
        <PortfolioSection />
        <PricingSection onPackageSelect={handlePackageSelect} />
        <BookingSection 
          selectedService={selectedService} 
          selectedPackage={selectedPackage}
          onServiceSelect={setSelectedService} 
          onPackageSelect={setSelectedPackage}
        />
        <ContactSection />
      </Layout>
    </>
  );
} 