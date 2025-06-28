import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import HeroSection from '@/components/home/HeroSection';
import ServicesSection from '@/components/home/ServicesSection';
import PortfolioSection from '@/components/home/PortfolioSection';
import PricingSection from '@/components/home/PricingSection';
import BookingSection from '@/components/home/BookingSection';
import ContactSection from '@/components/home/ContactSection';

export default function Home() {
  return (
    <>
      <Head>
        <title>SleepySquid Drones | Professional Drone Services</title>
        <meta name="description" content="Professional drone services including aerial photography, videography, mapping, and more. Elevate your perspective with SleepySquid Drones." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <Layout>
        <HeroSection />
        <ServicesSection />
        <PortfolioSection />
        <PricingSection />
        <BookingSection />
        <ContactSection />
      </Layout>
    </>
  );
} 