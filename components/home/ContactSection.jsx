import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiPhone, FiMail, FiClock } from 'react-icons/fi';
import ReCAPTCHA from 'react-google-recaptcha';

const ContactSection = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const recaptchaRef = useRef(null);
  
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const handleRecaptchaChange = (token) => {
    setRecaptchaToken(token);
    if (formErrors.recaptcha) {
      setFormErrors(prev => ({ ...prev, recaptcha: '' }));
    }
  };

  const handleRecaptchaExpired = () => {
    setRecaptchaToken('');
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setFormErrors({});
    setSubmitStatus(null);

    // Validate reCAPTCHA (only if configured)
    if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      if (!recaptchaToken) {
        setFormErrors({ recaptcha: 'Please complete the reCAPTCHA verification' });
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          ...(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && { recaptchaToken })
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Success
        setSubmitStatus({
          type: 'success',
          message: result.message || 'Message sent successfully! We will get back to you within 24 hours.'
        });
        
        // Reset form
        reset();
        setRecaptchaToken('');
        if (recaptchaRef.current) {
          recaptchaRef.current.reset();
        }
      } else {
        // Handle API errors
        if (result.error === 'Missing reCAPTCHA' || result.error === 'reCAPTCHA verification failed') {
          setFormErrors({ recaptcha: result.message });
          // Reset reCAPTCHA on error
          if (recaptchaRef.current) {
            recaptchaRef.current.reset();
          }
          setRecaptchaToken('');
        } else if (result.error === 'Rate limit exceeded') {
          setSubmitStatus({
            type: 'error',
            message: result.message
          });
        } else {
          setSubmitStatus({
            type: 'error',
            message: result.message || 'Something went wrong. Please try again.'
          });
        }
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      setSubmitStatus({
        type: 'error',
        message: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">Get In Touch</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Have questions about our drone services? Reach out to us and we&apos;ll respond as soon as possible
          </p>
        </div>

        <motion.div 
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto"
        >
          {/* Contact Form */}
          <div className="bg-white dark:bg-gray-700 rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Send Us a Message</h3>
            
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    {...register("name", { required: true, maxLength: 100 })}
                    className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="John Doe"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                      {errors.name.type === 'maxLength' ? 'Name cannot exceed 100 characters' : 'Please enter your name'}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...register("email", { 
                      required: true,
                      pattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
                    })}
                    className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                      errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1">Please enter a valid email</p>
                  )}
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  {...register("subject", { required: true, maxLength: 200 })}
                  className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    errors.subject ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="How can we help you?"
                />
                {errors.subject && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                    {errors.subject.type === 'maxLength' ? 'Subject cannot exceed 200 characters' : 'Please enter a subject'}
                  </p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  {...register("message", { required: true, maxLength: 2000 })}
                  rows="5"
                  className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    errors.message ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Tell us about your project or question..."
                ></textarea>
                {errors.message && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                    {errors.message.type === 'maxLength' ? 'Message cannot exceed 2000 characters' : 'Please enter your message'}
                  </p>
                )}
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
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        ⚠️ reCAPTCHA not configured. Please set NEXT_PUBLIC_RECAPTCHA_SITE_KEY in your environment variables.
                      </p>
                    </div>
                  )}
                </div>
                {formErrors.recaptcha && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-2 text-center">{formErrors.recaptcha}</p>
                )}
              </div>

              {/* Status Messages */}
              {submitStatus && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  submitStatus.type === 'success' 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-sm ${
                    submitStatus.type === 'success' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {submitStatus.message}
                  </p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-500 to-teal-400 dark:from-blue-600 dark:to-teal-500 text-white py-3 px-6 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </button>
            </form>
          </div>
          
          {/* Contact Information */}
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Contact Information</h3>
              
              <div className="space-y-6">
                {/* <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mr-4">
                    <FiMapPin className="text-blue-500 dark:text-blue-400 text-xl" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">Our Location</h4>
                    <p className="text-gray-600 dark:text-gray-300">123 Drone Avenue, Skyview City, CA 90210</p>
                  </div>
                </div> */}
                
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mr-4">
                    <FiPhone className="text-blue-500 dark:text-blue-400 text-xl" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">Phone Number</h4>
                    <p className="text-gray-600 dark:text-gray-300">(123) 456-7890</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mr-4">
                    <FiMail className="text-blue-500 dark:text-blue-400 text-xl" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">Email Address</h4>
                    <p className="text-gray-600 dark:text-gray-300">info@sleepysquid.com</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full mr-4">
                    <FiClock className="text-blue-500 dark:text-blue-400 text-xl" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">Business Hours</h4>
                    <p className="text-gray-600 dark:text-gray-300">Monday - Friday: 9am - 6pm</p>
                    <p className="text-gray-600 dark:text-gray-300">Saturday: 10am - 4pm</p>
                    <p className="text-gray-600 dark:text-gray-300">Sunday: Closed</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Map */}
            {/* <div className="mt-8 h-64 bg-gray-200 dark:bg-gray-600 rounded-xl overflow-hidden">
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-600">
                <p className="text-gray-500 dark:text-gray-400">Interactive Map Goes Here</p>
              </div>
            </div> */}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;
