import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiCheck, FiGift } from 'react-icons/fi';

const pricingPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 199,
    serviceId: 'aerial-photography',
    description: 'Essential aerial package perfect for real estate listings, basic inspections, or simple photography projects',
    features: [
      'Up to 1 hour flight time',
      '15-20 high-resolution photos',
      'Key angle coverage (4-8 shots)',
      'Birds eye overview shots',
      'Property/subject elevation views',
      'Basic photo editing & color correction',
      'Digital delivery within 48 hours',
      'Commercial usage rights included'
    ],
    popular: false
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 399,
    serviceId: 'real-estate',
    description: 'Complete aerial documentation ideal for real estate marketing, event coverage, or comprehensive projects',
    features: [
      'Up to 2 hours flight time',
      '20-30 high-resolution photos',
      'Comprehensive angle coverage (8+ positions)',
      'Multiple altitude perspectives',
      'Detail and overview combinations',
      '2-3 minute edited highlight video',
      'Advanced photo editing & color grading',
      'Next-day digital delivery',
      'Raw files included',
      'Commercial usage rights'
    ],
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 799,
    serviceId: 'mapping-surveying',
    description: 'Professional-grade package designed for mapping, commercial inspections, or premium documentation needs',
    features: [
      'Up to 4 hours flight time',
      'Comprehensive photo coverage (50+ images)',
      'Automated flight planning for precision',
      'Specialized data collection (mapping/3D)',
      'Complete 360° coverage at multiple altitudes',
      'Custom flight path planning',
      '5+ minute professional video production',
      'Advanced analytics & measurements',
      'Same-day rush delivery available',
      'Raw footage & source files',
      'Extended commercial licensing'
    ],
    popular: false
  }
];

const PricingSection = ({ onPackageSelect }) => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  const [activePromo, setActivePromo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivePromo();
  }, []);

  const fetchActivePromo = async () => {
    try {
      const response = await fetch('/api/promo/active');
      if (response.ok) {
        const data = await response.json();
        if (data.hasActivePromo) {
          setActivePromo(data.promo);
        }
      }
    } catch (error) {
      console.error('Error fetching active promo:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscountedPrice = (originalPrice) => {
    if (!activePromo) return originalPrice;
    const discount = (originalPrice * activePromo.discountPercentage) / 100;
    return Math.round(originalPrice - discount);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  return (
    <section id="pricing" className="py-20 bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Choose the perfect drone service package for your needs with our all-inclusive pricing
          </p>
          
          {activePromo && (
            <div className="mt-8 max-w-2xl mx-auto">
              <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
                <div className="flex items-center justify-center mb-2">
                  <FiGift className="h-6 w-6 mr-2" />
                  <h3 className="text-xl font-bold">{activePromo.name}</h3>
                </div>
                <p className="text-lg mb-3">{activePromo.description}</p>
                <div className="flex items-center justify-center space-x-4">
                  <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2">
                    <span className="text-2xl font-bold">{activePromo.discountPercentage}% OFF</span>
                  </div>
                  <div className="text-sm opacity-90">
                    Valid until {new Date(activePromo.endDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <motion.div 
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {pricingPlans.map((plan) => (
            <PricingCard 
              key={plan.id} 
              plan={plan} 
              variants={itemVariants} 
              onPackageSelect={onPackageSelect}
              activePromo={activePromo}
              calculateDiscountedPrice={calculateDiscountedPrice}
            />
          ))}
        </motion.div>

        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Need a custom package for your specific project requirements?
          </p>
          <a 
            href="#contact" 
            className="inline-flex items-center text-blue-500 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Contact us for a custom quote
            <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};

const PricingCard = ({ plan, variants, onPackageSelect, activePromo, calculateDiscountedPrice }) => {
  const handleBookPackage = (e) => {
    e.preventDefault();
    if (onPackageSelect) {
      onPackageSelect(plan.serviceId, plan.id);
    }
  };

  return (
    <motion.div 
      variants={variants}
      className={`bg-white dark:bg-gray-700 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl dark:shadow-gray-900/50 transition-all duration-300 border ${
        plan.popular ? 'border-blue-500 dark:border-blue-400' : 'border-transparent'
      }`}
    >
      {plan.popular && (
        <div className="bg-blue-500 dark:bg-blue-600 text-white text-center py-2 font-medium">
          Most Popular
        </div>
      )}
      
      <div className="p-8">
        <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{plan.name}</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{plan.description}</p>
        
        <div className="mb-6">
          {activePromo ? (
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 line-through text-lg">
                ${plan.price}
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                ${calculateDiscountedPrice(plan.price)}
              </div>
              <div className="text-green-600 dark:text-green-400 font-medium">
                Save ${plan.price - calculateDiscountedPrice(plan.price)}
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">/ project</span>
            </div>
          ) : (
            <>
              <span className="text-4xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
              <span className="text-gray-500 dark:text-gray-400"> / project</span>
            </>
          )}
        </div>
        
        <ul className="space-y-3 mb-8">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <FiCheck className="text-green-500 dark:text-green-400 mt-1 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
        
        <button 
          onClick={handleBookPackage}
          className={`block w-full text-center py-3 px-6 rounded-full font-medium transition-colors ${
            plan.popular 
              ? 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700' 
              : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500'
          }`}
        >
          Book This Package
        </button>
      </div>
    </motion.div>
  );
};

export default PricingSection; 