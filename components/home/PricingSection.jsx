import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiCheck } from 'react-icons/fi';

const pricingPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 199,
    description: 'Perfect for small projects and basic aerial photography needs',
    features: [
      '1 hour of drone flight time',
      'Up to 20 high-resolution photos',
      '1 edited highlight video (1 minute)',
      'Basic color correction',
      'Digital delivery within 3 days',
      'Commercial usage rights'
    ],
    popular: false
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 399,
    description: 'Our most popular package for real estate and events',
    features: [
      '2 hours of drone flight time',
      'Up to 50 high-resolution photos',
      '1 edited video (3 minutes)',
      'Advanced color grading',
      'Digital delivery within 2 days',
      'Commercial usage rights',
      'Raw footage included',
      'Basic 3D mapping'
    ],
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 799,
    description: 'Comprehensive drone services for professional projects',
    features: [
      '4 hours of drone flight time',
      'Unlimited high-resolution photos',
      'Custom edited video (5 minutes)',
      'Professional color grading',
      'Next-day digital delivery',
      'Commercial usage rights',
      'Raw footage included',
      'Advanced 3D mapping',
      'Thermal imaging',
      'Custom flight patterns'
    ],
    popular: false
  }
];

const PricingSection = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

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
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the perfect drone service package for your needs with our all-inclusive pricing
          </p>
        </div>

        <motion.div 
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {pricingPlans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} variants={itemVariants} />
          ))}
        </motion.div>

        <div className="text-center mt-12">
          <p className="text-gray-600 mb-6">
            Need a custom package for your specific project requirements?
          </p>
          <a 
            href="#contact" 
            className="inline-flex items-center text-blue-500 font-medium hover:text-blue-700 transition-colors"
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

const PricingCard = ({ plan, variants }) => {
  return (
    <motion.div 
      variants={variants}
      className={`bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 border ${
        plan.popular ? 'border-blue-500' : 'border-transparent'
      }`}
    >
      {plan.popular && (
        <div className="bg-blue-500 text-white text-center py-2 font-medium">
          Most Popular
        </div>
      )}
      
      <div className="p-8">
        <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
        <p className="text-gray-600 mb-6">{plan.description}</p>
        
        <div className="mb-6">
          <span className="text-4xl font-bold">${plan.price}</span>
          <span className="text-gray-500"> / project</span>
        </div>
        
        <ul className="space-y-3 mb-8">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <FiCheck className="text-green-500 mt-1 mr-2" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        <a 
          href="#booking" 
          className={`block text-center py-3 px-6 rounded-full font-medium transition-colors ${
            plan.popular 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          Book This Package
        </a>
      </div>
    </motion.div>
  );
};

export default PricingSection; 