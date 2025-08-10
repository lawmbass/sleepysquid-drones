import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiCamera, FiMap, FiHome, FiActivity, FiSearch } from 'react-icons/fi';
import Image from 'next/image';

const services = [
  {
    id: 1,
    title: 'Aerial Photography & Videography',
    serviceId: 'aerial-media',
    description: 'Stunning high-resolution photos and cinematic aerial footage from unique perspectives, perfect for real estate, events, marketing, or personal projects.',
    icon: <FiCamera className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1534996858221-380b92700493?q=80&w=2671&auto=format&fit=crop'
  },
  {
    id: 2,
    title: 'Mapping & Surveying',
    serviceId: 'mapping-surveying',
    description: 'Precise aerial mapping and 3D modeling for construction, agriculture, and land development projects.',
    icon: <FiMap className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?q=80&w=2574&auto=format&fit=crop'
  },
  {
    id: 3,
    title: 'Real Estate Tours',
    serviceId: 'real-estate',
    description: 'Comprehensive aerial property tours that showcase homes, land, and commercial properties from every angle.',
    icon: <FiHome className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2670&auto=format&fit=crop'
  },
  {
    id: 4,
    title: 'Inspection Services',
    serviceId: 'inspection',
    description: 'Safe and efficient inspections of roofs, towers, power lines, and other hard-to-reach infrastructure.',
    icon: <FiSearch className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1591588582259-e675bd2e6088?q=80&w=2670&auto=format&fit=crop'
  },
  {
    id: 5,
    title: 'Event Coverage',
    serviceId: 'event-coverage',
    description: 'Dynamic aerial documentation of weddings, sports events, festivals, and other special occasions.',
    icon: <FiActivity className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2670&auto=format&fit=crop'
  }
];

const ServicesSection = ({ onServiceSelect }) => {
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
    <section id="services" className="py-20 bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">Our Drone Services</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Discover how our professional drone services can transform your projects with stunning aerial perspectives
          </p>
        </div>

        <motion.div 
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} variants={itemVariants} onServiceSelect={onServiceSelect} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const ServiceCard = ({ service, variants, onServiceSelect }) => {
  const handleBookService = (e) => {
    e.preventDefault();
    if (onServiceSelect) {
      onServiceSelect(service.serviceId);
    }
  };

  return (
    <motion.div 
      variants={variants}
      className="bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-xl dark:shadow-gray-900/50 transition-all duration-300"
    >
      <div className="h-48 overflow-hidden relative">
        <Image 
          src={service.image} 
          alt={service.title} 
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 hover:scale-110"
        />
      </div>
      <div className="p-6">
        <div className="mb-4">{service.icon}</div>
        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{service.title}</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{service.description}</p>
        <button 
          onClick={handleBookService}
          className="text-blue-500 dark:text-blue-400 font-medium flex items-center hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          Book this service
          <svg className="ml-1 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

export default ServicesSection; 