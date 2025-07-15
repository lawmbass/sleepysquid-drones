import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiCalendar, FiMapPin, FiClock, FiInfo, FiUser, FiMail, FiPhone, FiPackage } from 'react-icons/fi';
import ReCAPTCHA from 'react-google-recaptcha';

const services = [
  { id: 'aerial-photography', name: 'Aerial Photography' },
  { id: 'drone-videography', name: 'Drone Videography' },
  { id: 'mapping-surveying', name: 'Mapping & Surveying' },
  { id: 'real-estate', name: 'Real Estate Tours' },
  { id: 'inspection', name: 'Inspection Services' },
  { id: 'event-coverage', name: 'Event Coverage' },
  { id: 'custom', name: 'Custom Project' }
];

const packages = [
  { id: 'basic', name: 'Basic Package - $199', description: 'Essential aerial package perfect for real estate listings, basic inspections, or simple photography projects' },
  { id: 'standard', name: 'Standard Package - $399', description: 'Complete aerial documentation ideal for real estate marketing, event coverage, or comprehensive projects' },
  { id: 'premium', name: 'Premium Package - $799', description: 'Professional-grade package designed for mapping, commercial inspections, or premium documentation needs' }
];

const BookingSection = ({ selectedService = '', selectedPackage = '', onServiceSelect, onPackageSelect }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    service: '',
    package: '',
    date: '',
    location: '',
    duration: '',
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
  
  // Create refs
  const dateInputRef = useRef(null);
  const recaptchaRef = useRef(null);
  const formContainerRef = useRef(null);

  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  // Set isClient to true when component mounts in the browser
  useEffect(() => {
    setMinDate(getMinDate());
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (currentStep) => {
    const newErrors = {};
    
    if (currentStep === 1) {
      if (!formData.service) newErrors.service = 'Please select a service';
      if (!formData.date) newErrors.date = 'Please select a date';
      if (!formData.location) newErrors.location = 'Please enter a location';
      if (!formData.duration) newErrors.duration = 'Please select a duration';
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
    return formData.service && formData.date && formData.location && formData.duration;
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

  // Calculate minimum date (1 week from today)
  function getMinDate() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }

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
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="package">
                    <div className="flex items-center">
                      <FiPackage className="mr-2 text-blue-500 dark:text-blue-400" />
                      Select Package (Optional)
                    </div>
                  </label>
                  <div className="relative">
                    <select
                      id="package"
                      name="package"
                      value={formData.package}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50 appearance-none"
                    >
                      <option value="">No package selected (custom pricing)</option>
                      {packages.map((pkg) => (
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
                      {packages.find(pkg => pkg.id === formData.package)?.description}
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="date">
                    <div className="flex items-center">
                      <FiCalendar className="mr-2 text-blue-500 dark:text-blue-400" />
                      Preferred Date*
                    </div>
                  </label>
                  <div 
                    className="relative cursor-pointer"
                    onClick={handleDateFieldClick}
                  >
                    <input
                      type="date"
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
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Please choose a date that&apos;s at least 7 days from today.</p>
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
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2" htmlFor="duration">
                    <div className="flex items-center">
                      <FiClock className="mr-2 text-blue-500 dark:text-blue-400" />
                      Duration*
                    </div>
                  </label>
                  <div className="relative">
                    <select
                      id="duration"
                      name="duration"
                      value={formData.duration}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 rounded-lg border ${errors.duration ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50 appearance-none`}
                    >
                      <option value="">Select duration</option>
                      <option value="1-2 hours">1-2 Hours</option>
                      <option value="3-4 hours">3-4 Hours</option>
                      <option value="5-8 hours">5-8 Hours</option>
                      <option value="Full day">Full Day</option>
                      <option value="Multiple days">Multiple Days</option>
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  {errors.duration && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.duration}</p>}
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
                </p>
                <div className="bg-gray-100 dark:bg-gray-600 rounded-lg p-6 text-left mb-6">
                  <h4 className="font-bold mb-3 text-gray-900 dark:text-white">Booking Summary:</h4>
                  {bookingResult && (
                    <p className="text-gray-700 dark:text-gray-300 mb-2"><span className="font-medium">Booking ID:</span> {bookingResult.id}</p>
                  )}
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Service:</span> {services.find(s => s.id === formData.service)?.name || formData.service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  {formData.package && (
                    <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Package:</span> {packages.find(p => p.id === formData.package)?.name || formData.package.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  )}
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Date:</span> {formatDate(formData.date)}</p>
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Location:</span> {formData.location}</p>
                  <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Duration:</span> {formData.duration}</p>
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
                      duration: '',
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
    </section>
  );
};

export default BookingSection;
