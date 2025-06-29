import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiCamera, FiVideo, FiMap, FiHome, FiActivity, FiSearch } from 'react-icons/fi';

const services = [
  {
    id: 1,
    title: 'Aerial Photography',
    serviceId: 'aerial-photography',
    description: 'Stunning high-resolution photos from unique aerial perspectives, perfect for real estate, events, or personal projects.',
    icon: <FiCamera className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1534996858221-380b92700493?q=80&w=2671&auto=format&fit=crop'
  },
  {
    id: 2,
    title: 'Drone Videography',
    serviceId: 'drone-videography',
    description: 'Cinematic aerial footage that captures dynamic movement and sweeping landscapes for films, marketing, or special occasions.',
    icon: <FiVideo className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1508444845599-5c89863b1c44?q=80&w=2671&auto=format&fit=crop'
  },
  {
    id: 3,
    title: 'Mapping & Surveying',
    serviceId: 'mapping-surveying',
    description: 'Precise aerial mapping and 3D modeling for construction, agriculture, and land development projects.',
    icon: <FiMap className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?q=80&w=2574&auto=format&fit=crop'
  },
  {
    id: 4,
    title: 'Real Estate Tours',
    serviceId: 'real-estate',
    description: 'Comprehensive aerial property tours that showcase homes, land, and commercial properties from every angle.',
    icon: <FiHome className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2670&auto=format&fit=crop'
  },
  {
    id: 5,
    title: 'Inspection Services',
    serviceId: 'inspection',
    description: 'Safe and efficient inspections of roofs, towers, power lines, and other hard-to-reach infrastructure.',
    icon: <FiSearch className="text-4xl text-blue-500" />,
    image: 'https://images.unsplash.com/photo-1591588582259-e675bd2e6088?q=80&w=2670&auto=format&fit=crop'
  },
  {
    id: 6,
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
    <section id="services" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Drone Services</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
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
  // Add error handling for image loading
  const handleImageError = (e) => {
    console.error(`Error loading image for ${service.title}`);
    // Set a fallback image
    e.target.src = "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?q=80&w=2670&auto=format&fit=crop";
  };

  const handleBookService = (e) => {
    e.preventDefault();
    if (onServiceSelect) {
      onServiceSelect(service.serviceId);
    }
  };

  return (
    <motion.div 
      variants={variants}
      className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300"
    >
      <div className="h-48 overflow-hidden">
        <img 
          src={service.image} 
          alt={service.title} 
          onError={handleImageError}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
        />
      </div>
      <div className="p-6">
        <div className="mb-4">{service.icon}</div>
        <h3 className="text-xl font-bold mb-2">{service.title}</h3>
        <p className="text-gray-600 mb-4">{service.description}</p>
        <button 
          onClick={handleBookService}
          className="text-blue-500 font-medium flex items-center hover:text-blue-700 transition-colors"
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