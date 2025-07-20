import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiCalendar, FiMapPin, FiClock, FiInfo, FiUser, FiMail, FiPhone, FiPackage, FiX } from 'react-icons/fi';
import ReCAPTCHA from 'react-google-recaptcha';
import Link from 'next/link';

const services = [
  { id: 'aerial-photography', name: 'Aerial Photography' },
  { id: 'drone-videography', name: 'Drone Videography' },
  { id: 'mapping-surveying', name: 'Mapping & Surveying' },
  { id: 'real-estate', name: 'Real Estate Tours' },
  { id: 'inspection', name: 'Inspection Services' },
  { id: 'event-coverage', name: 'Event Coverage' },
  { id: 'custom', name: 'Custom Project' }
];



const BookingSection = ({ selectedService = '', selectedPackage = '', onServiceSelect, onPackageSelect }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    service: '',
    package: '',
    date: '',
    location: '',
    details: '',
    name: '',
    email: '',
    phone: ''
  });
  const [errors, setErrors] = useState({});
  const [minDate, setMinDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [showPackageInfo, setShowPackageInfo] = useState(false);
  
  // Create refs
  const dateInputRef = useRef(null);
  const recaptchaRef = useRef(null);
  const formContainerRef = useRef(null);

  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  // Set minimum datetime when component mounts
  useEffect(() => {
    setMinDate(getMinDateTime());
  }, []);

  // Handle pre-selected service and package
  useEffect(() => {
    if (selectedService) {
      setFormData(prev => ({ ...prev, service: selectedService }));
      // Clear the selection after setting it
      if (onServiceSelect) {
        onServiceSelect('');
      }
    }
  }, [selectedService, onServiceSelect]);

  useEffect(() => {
    if (selectedPackage) {
      setFormData(prev => ({ ...prev, package: selectedPackage }));
      // Clear the selection after setting it
      if (onPackageSelect) {
        onPackageSelect('');
      }
    }
  }, [selectedPackage, onPackageSelect]);

  // Helper function to get available packages for a service type
  const getAvailablePackages = (serviceType) => {
    const allPackages = [
      { id: 'basic', name: 'Basic Package - $199', description: 'Essential aerial package perfect for real estate listings, basic inspections, or simple photography projects' },
      { id: 'standard', name: 'Standard Package - $399', description: 'Complete aerial documentation ideal for real estate marketing, event coverage, or comprehensive projects' },
      { id: 'premium', name: 'Premium Package - $799', description: 'Professional-grade package designed for mapping, commercial inspections, or premium documentation needs' }
    ];

    // Services that require at least Standard package (no Basic)
    const standardMinServices = ['drone-videography', 'mapping-surveying', 'inspection', 'event-coverage', 'custom'];
    
    if (standardMinServices.includes(serviceType)) {
      return allPackages.filter(pkg => pkg.id !== 'basic');
    }
    
    return allPackages;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle service change with package reset logic
    if (name === 'service') {
      const availablePackages = getAvailablePackages(value);
      // Reset package if current selection is not available for new service
      const newPackage = availablePackages.find(pkg => pkg.id === formData.package) ? formData.package : '';
      setFormData(prev => ({ ...prev, [name]: value, package: newPackage }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Special validation for date field
    if (name === 'date' && value) {
      if (!isValidDate(value)) {
        setErrors(prev => ({ ...prev, [name]: 'Please select a date that is at least 2 days from today' }));
        return;
      }
    }
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (currentStep) => {
    const newErrors = {};
    
    if (currentStep === 1) {
      if (!formData.service) newErrors.service = 'Please select a service';
      if (!formData.date) {
        newErrors.date = 'Please select a date and time';
      } else if (!isValidDate(formData.date)) {
        newErrors.date = 'Please select a date that is at least 2 days from today';
      }
      if (!formData.location) newErrors.location = 'Please enter a location';
    }
    
    if (currentStep === 2) {
      if (!formData.name) newErrors.name = 'Please enter your name';
      if (!formData.email) {
        newErrors.email = 'Please enter your email';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
      if (!formData.phone) newErrors.phone = 'Please enter your phone number';
      
      // Always validate reCAPTCHA (required for security)
      if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
        newErrors.recaptcha = 'reCAPTCHA is required but not configured';
      } else if (!recaptchaToken) {
        newErrors.recaptcha = 'Please complete the reCAPTCHA verification';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper function to check if Step 1 is ready for next step
  const isStep1ReadyForNext = () => {
    return formData.service && formData.date && formData.location;
  };

  // Helper function to check if form is ready for submission
  const isFormReadyForSubmission = () => {
    // Check if all required fields are filled
    const requiredFieldsFilled = formData.name && formData.email && formData.phone;
    
    // Check if email is valid (only if email is provided)
    const emailValid = formData.email ? /\S+@\S+\.\S+/.test(formData.email) : false;
    
    // Check if reCAPTCHA is configured and completed (always required)
    const recaptchaValid = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && recaptchaToken;
    
    return requiredFieldsFilled && emailValid && recaptchaValid;
  };

  // Smooth scroll to form when step changes
  const scrollToForm = () => {
    if (formContainerRef.current) {
      const rect = formContainerRef.current.getBoundingClientRect();
      const currentScrollY = window.pageYOffset;
      
      // Calculate the target position with a safe offset
      const yOffset = -80; // Increased offset to ensure we stay within the booking section
      const targetY = rect.top + currentScrollY + yOffset;
      
      // Get the booking section element to ensure we don't scroll past it
      const bookingSection = document.getElementById('booking');
      if (bookingSection) {
        const bookingSectionRect = bookingSection.getBoundingClientRect();
        const bookingSectionTop = bookingSectionRect.top + currentScrollY;
        const bookingSectionBottom = bookingSectionTop + bookingSectionRect.height;
        
        // Check if booking section is shorter than viewport
        const isShortSection = bookingSectionRect.height < window.innerHeight;
        
        let safeTargetY;
        if (isShortSection) {
          // For short sections, just ensure we don't go above the booking section
          // and use the target position directly since the whole section fits in viewport
          safeTargetY = Math.max(bookingSectionTop, targetY);
        } else {
          // For tall sections, ensure we don't scroll past the bottom
          const maxScrollY = bookingSectionBottom - window.innerHeight + 100;
          const upperBound = Math.max(bookingSectionTop, maxScrollY);
          safeTargetY = Math.max(bookingSectionTop, Math.min(targetY, upperBound));
        }
        
        window.scrollTo({ top: safeTargetY, behavior: 'smooth' });
      } else {
        // Fallback if booking section isn't found
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
      // Scroll to form after state update
      setTimeout(scrollToForm, 100);
    }
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
    // Scroll to form after state update
    setTimeout(scrollToForm, 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(step)) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          recaptchaToken
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - save booking result and show confirmation
        setBookingResult(data.booking);
        setStep(3);
      } else {
        // Handle API errors
        if (data.error === 'Missing required fields' || data.error === 'Validation failed') {
          setErrors({ general: data.message });
        } else if (data.error === 'Invalid email') {
          setErrors({ email: data.message });
        } else if (data.error === 'Invalid date') {
          setErrors({ date: data.message });
        } else if (data.error === 'Missing reCAPTCHA' || data.error === 'reCAPTCHA verification failed') {
          setErrors({ recaptcha: data.message });
          // Reset reCAPTCHA on error
          if (recaptchaRef.current) {
            recaptchaRef.current.reset();
          }
          setRecaptchaToken('');
        } else {
          setErrors({ general: data.message || 'Something went wrong. Please try again.' });
        }
      }
    } catch (error) {
      console.error('Booking submission error:', error);
      setErrors({ 
        general: 'Network error. Please check your connection and try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate minimum datetime (2 days from today)
  function getMinDateTime() {
    const minDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    return minDate.toISOString().slice(0, 16);
  }

  // Validate if selected datetime meets minimum requirement
  const isValidDate = (selectedDateTime) => {
    if (!selectedDateTime) return false;
    
    // Parse the datetime string (datetime-local format: YYYY-MM-DDTHH:mm)
    const selected = new Date(selectedDateTime);
    
    // Create minimum date/time - 2 days from now
    const minimum = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    
    return selected >= minimum;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Function to handle clicking on the date field container
  const handleDateFieldClick = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  // Handle reCAPTCHA change
  const handleRecaptchaChange = (token) => {
    setRecaptchaToken(token);
    if (errors.recaptcha) {
      setErrors(prev => ({ ...prev, recaptcha: '' }));
    }
  };

  // Handle reCAPTCHA expiration
  const handleRecaptchaExpired = () => {
    setRecaptchaToken('');
  };

  return (
    <section id="booking" className="py-20 bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">Book Your Drone Service</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Schedule your drone service with ease. We&apos;ll be in touch to confirm the details.
          </p>
        </div>

        <motion.div 
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div ref={formContainerRef}>
          {/* Progress Steps */}
          <div className="flex justify-between items-center mb-8">
            <div className={`flex flex-col items-center ${step >= 1 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step >= 1 ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                1
              </div>
              <span className="text-sm">Service Details</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${step >= 2 ? 'bg-blue-500 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}></div>
            <div className={`flex flex-col items-center ${step >= 2 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step >= 2 ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                2
              </div>
              <span className="text-sm">Your Information</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${step >= 3 ? 'bg-blue-500 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}></div>
            <div className={`flex flex-col items-center ${step >= 3 ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step >= 3 ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                3
              </div>
              <span className="text-sm">Confirmation</span>
            </div>
          </div>

          {/* Form Steps */}
          <div className="bg-white dark:bg-gray-700 rounded-xl shadow-lg p-8">
            {step === 1 && (
              <form>
                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="service">
                    <div className="flex items-center">
                      <FiClock className="mr-2 text-blue-500 dark:text-blue-400" />
                      Select Service*
                    </div>
                  </label>
                  <div className="relative">
                    <select
                      id="service"
                      name="service"
                      value={formData.service}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 rounded-lg border ${errors.service ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50 appearance-none`}
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  {errors.service && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.service}</p>}
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-700 dark:text-gray-300 font-medium" htmlFor="package">
                      <div className="flex items-center">
                        <FiPackage className="mr-2 text-blue-500 dark:text-blue-400" />
                        Select Package (Optional)
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPackageInfo(true)}
                      className="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                      title="Package information"
                    >
                      <FiInfo className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      id="package"
                      name="package"
                      value={formData.package}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50 appearance-none"
                    >
                      <option value="">No package selected (custom pricing)</option>
                      {getAvailablePackages(formData.service).map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  {formData.package && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      {getAvailablePackages(formData.service).find(pkg => pkg.id === formData.package)?.description}
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="date">
                    <div className="flex items-center">
                      <FiCalendar className="mr-2 text-blue-500 dark:text-blue-400" />
                      Preferred Date & Time*
                    </div>
                  </label>
                  <div 
                    className="relative cursor-pointer"
                    onClick={handleDateFieldClick}
                  >
                    <input
                      type="datetime-local"
                      id="date"
                      name="date"
                      ref={dateInputRef}
                      min={minDate}
                      value={formData.date}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 rounded-lg border ${errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50`}
                    />
                  </div>
                  {errors.date && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.date}</p>}
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Please select your preferred date and time (must be at least 2 days in advance).</p>
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="location">
                    <div className="flex items-center">
                      <FiMapPin className="mr-2 text-blue-500 dark:text-blue-400" />
                      Location*
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="location"
                      name="location"
                      placeholder="Enter the service location (address, city, or area)"
                      value={formData.location}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 rounded-lg border ${errors.location ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50`}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <FiMapPin className="text-gray-500" />
                    </div>
                  </div>
                  {errors.location && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.location}</p>}
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Enter a complete address for accurate service planning</p>
                </div>



                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="details">
                    <div className="flex items-center">
                      <FiInfo className="mr-2 text-blue-500 dark:text-blue-400" />
                      Additional Details
                    </div>
                  </label>
                  <textarea
                    id="details"
                    name="details"
                    rows="4"
                    placeholder="Please provide any additional information about your project"
                    value={formData.details}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50"
                  ></textarea>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!isStep1ReadyForNext()}
                    className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next Step
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="name">
                    <div className="flex items-center">
                      <FiUser className="mr-2 text-blue-500 dark:text-blue-400" />
                      Full Name*
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50`}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <FiUser className="text-gray-500" />
                    </div>
                  </div>
                  {errors.name && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.name}</p>}
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="email">
                    <div className="flex items-center">
                      <FiMail className="mr-2 text-blue-500 dark:text-blue-400" />
                      Email Address*
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="Enter your email address"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50`}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <FiMail className="text-gray-500" />
                    </div>
                  </div>
                  {errors.email && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.email}</p>}
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="phone">
                    <div className="flex items-center">
                      <FiPhone className="mr-2 text-blue-500 dark:text-blue-400" />
                      Phone Number*
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      placeholder="Enter your phone number"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border ${errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50`}
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <FiPhone className="text-gray-500" />
                    </div>
                  </div>
                  {errors.phone && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.phone}</p>}
                </div>

                {/* reCAPTCHA */}
                <div className="mb-6">
                  <div className="flex justify-center">
                    {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? (
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
                        onChange={handleRecaptchaChange}
                        onExpired={handleRecaptchaExpired}
                        theme="light"
                      />
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                        <p className="text-sm text-red-600 dark:text-red-400">
                          ❌ reCAPTCHA is required but not configured. Please contact the administrator.
                        </p>
                      </div>
                    )}
                  </div>
                  {errors.recaptcha && <p className="text-red-500 dark:text-red-400 text-sm mt-2 text-center">{errors.recaptcha}</p>}
                </div>

                {errors.general && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 text-sm">{errors.general}</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={isSubmitting}
                    className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !isFormReadyForSubmission()}
                    className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      'Submit Booking'
                    )}
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Booking Submitted!</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Thank you for booking with SleepySquid Drones. We&apos;ll review your request and contact you within 24 hours to confirm the details.
                  {bookingResult?.emailSent && (
                    <span className="block mt-2 text-green-600 dark:text-green-400">
                      ✅ A confirmation email has been sent to {formData.email}
                    </span>
                  )}
                </p>

                {/* Account creation prompt for users without accounts */}
                {bookingResult?.hasAccount === false && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6 text-left">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-blue-500 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          Manage Your Bookings
                        </h4>
                        <p className="text-blue-800 dark:text-blue-200 mb-4">
                          Create an account to easily manage your bookings, view status updates, and track your service history.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Link
                            href="/login"
                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                          >
                            Create Account & Manage Bookings
                          </Link>
                          <span className="text-sm text-blue-700 dark:text-blue-300 self-center">
                            Booking ID: <span className="font-mono font-semibold">{bookingResult?.id}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-gray-100 dark:bg-gray-600 rounded-lg p-6 text-left mb-6">
                  <h4 className="font-bold mb-3 text-gray-900 dark:text-white">Booking Summary:</h4>
                  {bookingResult && (
                    <p className="text-gray-700 dark:text-gray-300 mb-2"><span className="font-medium">Booking ID:</span> {bookingResult.id}</p>
                  )}
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Service:</span> {services.find(s => s.id === formData.service)?.name || formData.service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  {formData.package && (
                    <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Package:</span> {getAvailablePackages(formData.service).find(p => p.id === formData.package)?.name || formData.package.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  )}
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Date:</span> {formatDate(formData.date)}</p>
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Location:</span> {formData.location}</p>
                  {bookingResult?.estimatedPrice && (
                    <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Estimated Price:</span> ${bookingResult.estimatedPrice}</p>
                  )}
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Status:</span> <span className="capitalize">{bookingResult?.status || 'Pending'}</span></p>
                </div>
                <button
                  onClick={() => {
                    setStep(1);
                    setFormData({
                      service: '',
                      package: '',
                      date: '',
                      location: '',
                      details: '',
                      name: '',
                      email: '',
                      phone: ''
                    });
                    setErrors({});
                    setBookingResult(null);
                    setIsSubmitting(false);
                    setRecaptchaToken('');
                    if (recaptchaRef.current) {
                      recaptchaRef.current.reset();
                    }
                  }}
                  className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Book Another Service
                </button>
              </div>
            )}
          </div>
          </div>
        </motion.div>
      </div>

      {/* Package Info Dialog */}
      {showPackageInfo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Package Information</h3>
              <button
                onClick={() => setShowPackageInfo(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {formData.service && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Available for {formData.service.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}:</strong>
                  </p>
                </div>
              )}
              
              {getAvailablePackages(formData.service).find(pkg => pkg.id === 'basic') ? (
                <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Basic Package - $199</h4>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>• <strong>1 hour</strong> of flight time</li>
                    <li>• 10-15 high-resolution photos</li>
                    <li>• Basic editing included</li>
                    <li>• Digital delivery within 3-5 days</li>
                    <li>• Perfect for small properties or simple shots</li>
                  </ul>
                </div>
              ) : formData.service && (
                <div className="border rounded-lg p-4 bg-gray-100 dark:bg-gray-800 opacity-60 border-gray-300 dark:border-gray-600">
                  <h4 className="font-semibold text-gray-600 dark:text-gray-400 mb-2">Basic Package - $199 (Not Available)</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Not available for {formData.service.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')} services due to complexity requirements.
                  </p>
                  <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <li>• Up to 1 hour of flight time</li>
                    <li>• 10-15 high-resolution photos</li>
                    <li>• Basic editing included</li>
                    <li>• Digital delivery within 3-5 days</li>
                  </ul>
                </div>
              )}
              
              <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Standard Package - $399</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• <strong>2 hours</strong> of flight time</li>
                  <li>• 25-30 high-resolution photos</li>
                  <li>• 2-3 minutes of edited video</li>
                  <li>• Professional editing and color correction</li>
                  <li>• Digital delivery within 2-3 days</li>
                  <li>• Ideal for real estate and events</li>
                </ul>
              </div>
              
              <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Premium Package - $799</h4>
                <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                  <li>• <strong>4 hours</strong> of flight time</li>
                  <li>• 50+ high-resolution photos</li>
                  <li>• 5-10 minutes of cinematic video</li>
                  <li>• Advanced editing with music and transitions</li>
                  <li>• Same-day or next-day delivery</li>
                  <li>• Multiple angles and creative shots</li>
                  <li>• Perfect for commercial projects</li>
                </ul>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Note:</strong> All packages include travel within 25 miles. Additional travel fees may apply for longer distances. Weather delays may affect delivery times.
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Package Availability:</strong> Some services like videography, mapping, inspections, and events require more complex equipment and longer flight times, so Basic package is not available for these services.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BookingSection;
