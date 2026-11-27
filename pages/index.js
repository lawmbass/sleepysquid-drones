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
import { publicBookingSelection } from '@/libs/manualBooking';
import { resolvePublicReferralDiscount } from '@/libs/referrals.mjs';
import { getActivePromo } from '@/libs/db/promos';

export default function Home({ referralDiscount = null, initialService = '', initialPackage = '' }) {
  const [selectedService, setSelectedService] = useState(initialService);
  const [selectedPackage, setSelectedPackage] = useState(initialPackage);

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
        <title>SleepySquid Drones | Drone Photography &amp; Aerial Video in Washington, DC, MD &amp; VA</title>
        <meta name="description" content="Drone photography and aerial video in Washington, DC, Maryland, and Virginia. Flyable Maryland and Virginia suburbs, plus authorized DC operations. FAA Part 107 Certified & Insured, with $1M liability coverage." />
        <link rel="canonical" href="https://drones.sleepysquid.com/" />
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
  const selection = publicBookingSelection(query);
  return {
    props: {
      referralDiscount,
      initialService: selection.service,
      initialPackage: selection.packageId,
    },
  };
} 