import React from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiPhone, FiMail, FiClock } from 'react-icons/fi';

const ContactSection = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const onSubmit = (data) => {
    console.log(data);
    // Here you would typically send the data to your backend
    
    // Reset form after submission
    reset();
    
    // Show success message (you could implement a toast notification here)
    alert('Message sent successfully! We will get back to you soon.');
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
                    {...register("name", { required: true })}
                    className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="John Doe"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1">Please enter your name</p>
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
                  {...register("subject", { required: true })}
                  className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    errors.subject ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="How can we help you?"
                />
                {errors.subject && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">Please enter a subject</p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  {...register("message", { required: true })}
                  rows="5"
                  className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    errors.message ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Tell us about your project or question..."
                ></textarea>
                {errors.message && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-1">Please enter your message</p>
                )}
              </div>
              
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-teal-400 dark:from-blue-600 dark:to-teal-500 text-white py-3 px-6 rounded-lg font-medium hover:shadow-lg transition-all"
              >
                Send Message
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
