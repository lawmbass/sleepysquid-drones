import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiCheck, FiGift } from 'react-icons/fi';

const pricingPlans = [
  {
    id: 'listing-photos',
    name: 'Listing Photos',
    price: 199,
    serviceId: 'real-estate',
    description: 'Edited listing photos, delivered in 48 hours.',
    features: [
      '15-20 edited photos',
      '48-hour delivery',
    ],
    quote: false,
  },
  {
    id: 'listing-video',
    name: 'Listing Photos + Video',
    price: 399,
    serviceId: 'aerial-media',
    description: 'Listing photos plus a short edited video, delivered in 48 hours.',
    features: [
      '15-20 edited photos',
      'Short edited video up to 2 min',
      '48-hour delivery',
    ],
    quote: false,
    badge: 'Best for listings',
  },
  {
    id: 'event-aerials',
    name: 'Event Aerials',
    price: 500,
    serviceId: 'event-coverage',
    description: 'Photo and video coverage, priced by event.',
    features: [
      'Photo and video coverage',
      'Priced by event',
    ],
    quote: true,
  },
  {
    id: 'mapping-3d',
    name: 'Mapping & 3D',
    price: 900,
    serviceId: 'mapping-surveying',
    description: 'Mapping and 3D, by quote.',
    features: [
      'By quote',
    ],
    quote: true,
  },
];

const addOns = ['Raw files', 'Next-day delivery', 'Longer video edits'];

const PricingSection = ({ onPackageSelect }) => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  const [activePromo, setActivePromo] = useState(null);
  // Removed unused loading state

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
            Listing photos, photo and video, events, and mapping. Travel fees may apply.
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
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-6xl mx-auto"
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

        <div className="max-w-3xl mx-auto mt-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Add-ons on request</h3>
          <ul className="flex flex-col sm:flex-row sm:justify-center gap-2 sm:gap-6 text-gray-700 dark:text-gray-300">
            {addOns.map((addOn) => (
              <li key={addOn}>{addOn}</li>
            ))}
          </ul>
        </div>

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
        plan.badge ? 'border-blue-500 dark:border-blue-400' : 'border-transparent'
      }`}
    >
      {plan.badge && (
        <div className="bg-blue-500 dark:bg-blue-600 text-white text-center py-2 font-medium">
          {plan.badge}
        </div>
      )}
      
      <div className="p-8">
        <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{plan.name}</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{plan.description}</p>
        
        <div className="mb-6">
          {activePromo ? (
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 line-through text-lg">
                {plan.quote ? 'from ' : ''}${plan.price}
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {plan.quote ? <span className="text-lg font-medium text-gray-500 dark:text-gray-400">from </span> : null}
                ${calculateDiscountedPrice(plan.price)}
              </div>
              <div className="text-green-600 dark:text-green-400 font-medium">
                Save ${plan.price - calculateDiscountedPrice(plan.price)}
              </div>
              {plan.quote ? null : <span className="text-gray-500 dark:text-gray-400 text-sm">/ project</span>}
            </div>
          ) : (
            <>
              {plan.quote ? <span className="text-lg font-medium text-gray-500 dark:text-gray-400">from </span> : null}
              <span className="text-4xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
              {plan.quote ? null : <span className="text-gray-500 dark:text-gray-400"> / project</span>}
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
            plan.badge
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