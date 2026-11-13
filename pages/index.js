import { useState } from 'react';
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import PromoBanner from '@/components/home/PromoBanner';
import HeroSection from '@/components/home/HeroSection';
import ServicesSection from '@/components/home/ServicesSection';
import PortfolioSection from '@/components/home/PortfolioSection';
import PricingSection from '@/components/home/PricingSection';
import BookingSection from '@/components/home/BookingSection';
import ContactSection from '@/components/home/ContactSection';
import { renderSchemaTags } from '@/libs/seo';
import { resolvePublicReferralDiscount } from '@/libs/referrals.mjs';
import { getActivePromo } from '@/libs/db/promos';

export default function Home({ referralDiscount = null }) {
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
        <meta name="description" content="Professional drone services for aerial photography, videography, and mapping. FAA Part 107 Certified & Insured, with $1M liability coverage." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {renderSchemaTags()}

      <Layout>
        <PromoBanner />
        <HeroSection />
        <ServicesSection onServiceSelect={handleServiceSelect} />
        <PortfolioSection />
        <PricingSection onPackageSelect={handlePackageSelect} referralDiscount={referralDiscount} />
        <BookingSection 
          selectedService={selectedService} 
          selectedPackage={selectedPackage}
          onServiceSelect={setSelectedService} 
          onPackageSelect={setSelectedPackage}
          referralDiscount={referralDiscount}
        />
        <ContactSection />
      </Layout>
    </>
  );
}

export async function getServerSideProps({ req, query }) {
  const referralDiscount = await resolvePublicReferralDiscount({
    req,
    query,
    getPromo: () => getActivePromo(),
  });
  return { props: { referralDiscount } };
} 