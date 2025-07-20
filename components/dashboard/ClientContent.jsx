import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiFileText, FiPlus, FiFolder, FiCheckCircle, FiClock, FiAlertCircle, FiEye, FiEdit3, FiCalendar, FiMapPin, FiDollarSign, FiImage, FiDownload, FiX, FiEdit, FiTrash2, FiInfo } from 'react-icons/fi';
import Settings from './Settings';

export default function ClientContent({ user, onUpdate }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [jobStats, setJobStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJobDetail, setShowJobDetail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPackageInfo, setShowPackageInfo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    service: '',
    package: '',
    date: '',
    location: '',
    details: '',
    phone: ''
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Update active section based on URL query
  useEffect(() => {
    const section = router.query.section || 'dashboard';
    
    // Handle backward compatibility: redirect profile to settings
    if (section === 'profile') {
      router.replace('/dashboard?section=settings');
      return;
    }
    
    setActiveSection(section);
    
    // Load jobs for dashboard stats and jobs section
    if (section === 'jobs' || section === 'dashboard') {
      fetchJobs();
    }
  }, [router.query.section, router]);

  // Populate edit form when a job is selected for editing
  useEffect(() => {
    if (selectedJob && showEditModal) {
      setEditFormData({
        service: selectedJob.service || '',
        package: selectedJob.package || '',
        date: selectedJob.date ? new Date(selectedJob.date).toISOString().slice(0, 16) : '',
        location: selectedJob.location || '',
        details: selectedJob.details || '',
        phone: selectedJob.phone || user?.phone || ''
      });
    }
  }, [selectedJob, showEditModal, user?.phone]);

  // Fetch user's jobs
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/bookings');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.data.bookings);
        setJobStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete job
  const handleDeleteJob = async () => {
    if (!selectedJob) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch('/api/user/bookings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: selectedJob._id }),
      });

      if (response.ok) {
        setShowDeleteConfirm(false);
        setShowJobDetail(false);
        setSelectedJob(null);
        fetchJobs(); // Refresh the jobs list
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete job');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Update job
  const handleUpdateJob = async () => {
    if (!selectedJob) return;
    
    setIsEditSubmitting(true);
    try {
      const response = await fetch('/api/user/bookings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedJob._id,
          ...editFormData
        }),
      });

      if (response.ok) {
        setShowEditModal(false);
        setShowJobDetail(false);
        setSelectedJob(null);
        setEditFormData({
          service: '',
          package: '',
          date: '',
          location: '',
          duration: '',
          details: '',
          phone: ''
        });
        fetchJobs(); // Refresh the jobs list
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update job');
      }
    } catch (error) {
      console.error('Error updating job:', error);
      alert('Failed to update job. Please try again.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Get status color and icon
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { color: 'yellow', icon: FiClock, text: 'Pending' };
      case 'confirmed':
        return { color: 'blue', icon: FiCheckCircle, text: 'Confirmed' };
      case 'in-progress':
        return { color: 'purple', icon: FiEdit3, text: 'In Progress' };
      case 'completed':
        return { color: 'green', icon: FiCheckCircle, text: 'Completed' };
      case 'cancelled':
        return { color: 'red', icon: FiAlertCircle, text: 'Cancelled' };
      default:
        return { color: 'gray', icon: FiClock, text: 'Unknown' };
    }
  };

  // Format service type for display
  const formatServiceType = (service) => {
    return service.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Helper function to get available packages for a service type
  const getAvailablePackages = (serviceType) => {
    const packages = [
      { value: 'basic', label: 'Basic ($199)', minService: ['aerial-photography', 'real-estate'] },
      { value: 'standard', label: 'Standard ($399)', minService: ['all'] },
      { value: 'premium', label: 'Premium ($799)', minService: ['all'] }
    ];

    // Services that require at least Standard package (no Basic)
    const standardMinServices = ['drone-videography', 'mapping-surveying', 'inspection', 'event-coverage', 'custom'];
    
    if (standardMinServices.includes(serviceType)) {
      return packages.filter(pkg => pkg.value !== 'basic');
    }
    
    return packages;
  };

  // Create New Job Modal
  const CreateJobModal = () => {
    const [formData, setFormData] = useState({
      service: '',
      package: '',
      date: '',
      location: '',
      details: '',
      phone: user?.phone || ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            name: user.name,
            email: user.email,
            recaptchaToken: 'session-authenticated' // Since user is logged in
          }),
        });

        if (response.ok) {
          setShowCreateModal(false);
          setFormData({
            service: '',
            package: '',
            date: '',
            location: '',
            details: '',
            phone: user?.phone || ''
          });
          fetchJobs(); // Refresh jobs list
        } else {
          const error = await response.json();
          alert(error.message || 'Failed to create job');
        }
      } catch (error) {
        console.error('Error creating job:', error);
        alert('Failed to create job. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Create New Service Request</h3>
            <button
              onClick={() => setShowCreateModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Service Type</label>
                <select
                  value={formData.service}
                  onChange={(e) => {
                    const newService = e.target.value;
                    const availablePackages = getAvailablePackages(newService);
                    // Reset package if current selection is not available for new service
                    const newPackage = availablePackages.find(pkg => pkg.value === formData.package) ? formData.package : '';
                    setFormData({...formData, service: newService, package: newPackage});
                  }}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a service</option>
                  <option value="aerial-photography">Aerial Photography</option>
                  <option value="drone-videography">Drone Videography</option>
                  <option value="mapping-surveying">Mapping & Surveying</option>
                  <option value="real-estate">Real Estate</option>
                  <option value="inspection">Inspection</option>
                  <option value="event-coverage">Event Coverage</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Package</label>
                  <button
                    type="button"
                    onClick={() => setShowPackageInfo(true)}
                    className="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Package information"
                  >
                    <FiInfo className="w-4 h-4" />
                  </button>
                </div>
                <select
                  value={formData.package}
                  onChange={(e) => setFormData({...formData, package: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a package</option>
                  {getAvailablePackages(formData.service).map(pkg => (
                    <option key={pkg.value} value={pkg.value}>
                      {pkg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Preferred Date & Time</label>
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Please select your preferred date and time. We&apos;ll confirm availability and may suggest alternative times if needed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="Enter the location for the drone service"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="Your phone number"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Additional Details</label>
              <textarea
                value={formData.details}
                onChange={(e) => setFormData({...formData, details: e.target.value})}
                rows={3}
                placeholder="Describe your specific requirements..."
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-2 px-4 rounded-md"
              >
                {isSubmitting ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
          
          {/* Package Info Dialog */}
          {showPackageInfo && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-60 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Package Information</h3>
                  <button
                    onClick={() => setShowPackageInfo(false)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {formData.service && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>Available for {formData.service.split('-').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}:</strong>
                      </p>
                    </div>
                  )}
                  
                  {getAvailablePackages(formData.service).find(pkg => pkg.value === 'basic') ? (
                                         <div className="border rounded-lg p-4 bg-green-50">
                       <h4 className="font-semibold text-green-800 mb-2">Basic Package - $199</h4>
                       <ul className="text-sm text-green-700 space-y-1">
                         <li>• <strong>1 hour</strong> of flight time</li>
                         <li>• 10-15 high-resolution photos</li>
                         <li>• Basic editing included</li>
                         <li>• Digital delivery within 3-5 days</li>
                         <li>• Perfect for small properties or simple shots</li>
                       </ul>
                     </div>
                  ) : formData.service && (
                    <div className="border rounded-lg p-4 bg-gray-100 opacity-60">
                      <h4 className="font-semibold text-gray-600 mb-2">Basic Package - $199 (Not Available)</h4>
                      <p className="text-sm text-gray-500 mb-2">
                        Not available for {formData.service.split('-').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')} services due to complexity requirements.
                      </p>
                      <ul className="text-sm text-gray-500 space-y-1">
                        <li>• Up to 1 hour of flight time</li>
                        <li>• 10-15 high-resolution photos</li>
                        <li>• Basic editing included</li>
                        <li>• Digital delivery within 3-5 days</li>
                      </ul>
                    </div>
                  )}
                  
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <h4 className="font-semibold text-blue-800 mb-2">Standard Package - $399</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>2 hours</strong> of flight time</li>
                      <li>• 25-30 high-resolution photos</li>
                      <li>• 2-3 minutes of edited video</li>
                      <li>• Professional editing and color correction</li>
                      <li>• Digital delivery within 2-3 days</li>
                      <li>• Ideal for real estate and events</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-purple-50">
                    <h4 className="font-semibold text-purple-800 mb-2">Premium Package - $799</h4>
                    <ul className="text-sm text-purple-700 space-y-1">
                      <li>• <strong>4 hours</strong> of flight time</li>
                      <li>• 50+ high-resolution photos</li>
                      <li>• 5-10 minutes of cinematic video</li>
                      <li>• Advanced editing with music and transitions</li>
                      <li>• Same-day or next-day delivery</li>
                      <li>• Multiple angles and creative shots</li>
                      <li>• Perfect for commercial projects</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-gray-600">
                      <strong>Note:</strong> All packages include travel within 25 miles. Additional travel fees may apply for longer distances. Weather delays may affect delivery times.
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>Package Availability:</strong> Some services like videography, mapping, inspections, and events require more complex equipment and longer flight times, so Basic package is not available for these services.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Edit Job Modal
  const EditJobModal = () => {
    if (!selectedJob) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      handleUpdateJob();
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Edit Service Request</h3>
            <button
              onClick={() => setShowEditModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Service Type</label>
                <select
                  value={editFormData.service}
                  onChange={(e) => {
                    const newService = e.target.value;
                    const availablePackages = getAvailablePackages(newService);
                    // Reset package if current selection is not available for new service
                    const newPackage = availablePackages.find(pkg => pkg.value === editFormData.package) ? editFormData.package : '';
                    setEditFormData({...editFormData, service: newService, package: newPackage});
                  }}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a service</option>
                  <option value="aerial-photography">Aerial Photography</option>
                  <option value="drone-videography">Drone Videography</option>
                  <option value="mapping-surveying">Mapping & Surveying</option>
                  <option value="real-estate">Real Estate</option>
                  <option value="inspection">Inspection</option>
                  <option value="event-coverage">Event Coverage</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Package</label>
                <select
                  value={editFormData.package}
                  onChange={(e) => setEditFormData({...editFormData, package: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a package</option>
                  {getAvailablePackages(editFormData.service).map(pkg => (
                    <option key={pkg.value} value={pkg.value}>
                      {pkg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Preferred Date & Time</label>
              <input
                type="datetime-local"
                value={editFormData.date}
                onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Please select your preferred date and time. We&apos;ll confirm availability and may suggest alternative times if needed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                value={editFormData.location}
                onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                placeholder="Enter the location for the drone service"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                placeholder="Your phone number"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Additional Details</label>
              <textarea
                value={editFormData.details}
                onChange={(e) => setEditFormData({...editFormData, details: e.target.value})}
                rows={3}
                placeholder="Describe your specific requirements..."
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isEditSubmitting}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-2 px-4 rounded-md"
              >
                {isEditSubmitting ? 'Updating...' : 'Update Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Delete Confirmation Modal
  const DeleteConfirmModal = () => {
    if (!selectedJob) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-1/4 mx-auto p-5 border w-11/12 md:w-1/3 shadow-lg rounded-md bg-white">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <FiTrash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Job</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this job? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteJob}
                disabled={isDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white py-2 px-4 rounded-md"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Job Detail Modal
  const JobDetailModal = () => {
    if (!selectedJob) return null;
    
    const statusInfo = getStatusInfo(selectedJob.status);
    const StatusIcon = statusInfo.icon;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-medium text-gray-900">Job Details</h3>
              <div className="flex items-center mt-2">
                <StatusIcon className={`h-4 w-4 text-${statusInfo.color}-500 mr-2`} />
                <span className={`text-sm font-medium text-${statusInfo.color}-600`}>
                  {statusInfo.text}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {selectedJob.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      setShowJobDetail(false);
                      setShowEditModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-500 p-2"
                    title="Edit job"
                  >
                    <FiEdit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-600 hover:text-red-500 p-2"
                    title="Delete job"
                  >
                    <FiTrash2 className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                onClick={() => setShowJobDetail(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Service Type</label>
                <p className="mt-1 text-sm text-gray-900">{formatServiceType(selectedJob.service)}</p>
              </div>
              
              {selectedJob.package && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Package</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{selectedJob.package}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                <div className="flex items-center mt-1">
                  <FiCalendar className="h-4 w-4 text-gray-400 mr-2" />
                  <p className="text-sm text-gray-900">
                    {new Date(selectedJob.date).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <div className="flex items-start mt-1">
                  <FiMapPin className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                  <p className="text-sm text-gray-900">{selectedJob.location}</p>
                </div>
              </div>
              
              {(selectedJob.estimatedPrice || selectedJob.finalPrice) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {selectedJob.finalPrice ? 'Final Price' : 'Estimated Price'}
                  </label>
                  <div className="flex items-center mt-1">
                    <FiDollarSign className="h-4 w-4 text-gray-400 mr-2" />
                    <p className="text-sm text-gray-900">
                      ${selectedJob.finalPrice || selectedJob.estimatedPrice}
                    </p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(selectedJob.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          
          {selectedJob.details && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700">Details</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                {selectedJob.details}
              </p>
            </div>
          )}
          
          {/* Assets Section */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900 flex items-center">
                <FiFolder className="h-5 w-5 mr-2" />
                Assets
              </h4>
              {selectedJob.status === 'completed' && (
                <button className="text-blue-600 hover:text-blue-500 text-sm font-medium">
                  <FiDownload className="h-4 w-4 inline mr-1" />
                  Download All
                </button>
              )}
            </div>
            
            {selectedJob.status === 'completed' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Placeholder for future asset management */}
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <FiImage className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Assets will appear here when the job is completed</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <FiImage className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Assets will be available once the job is completed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Mobile compact dashboard component
  const MobileCompactDashboard = () => {
    const totalJobs = Object.values(jobStats).reduce((sum, stat) => sum + (stat.count || 0), 0);
    const completedJobs = jobStats.completed?.count || 0;
    const activeJobs = (jobStats.pending?.count || 0) + (jobStats.confirmed?.count || 0) + (jobStats['in-progress']?.count || 0);

    return (
      <div className="md:hidden space-y-4">
        {/* Welcome header */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Client Dashboard</h1>
          <p className="text-sm text-gray-600">Welcome back, {user.name}</p>
        </div>
        
        {/* Compact stats grid */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-gray-50 rounded-lg">
              <FiFileText className="h-6 w-6 text-gray-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-gray-900">{activeJobs}</div>
              <div className="text-xs text-gray-600">Active Jobs</div>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <FiCheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-green-600">{completedJobs}</div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg">
              <FiFolder className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-600">{totalJobs}</div>
              <div className="text-xs text-gray-600">Total Jobs</div>
            </div>
          </div>
        </div>
        
        {/* Quick actions */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium"
            >
              Create New Job
            </button>
            <button 
              onClick={() => router.push('/dashboard?section=jobs')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md text-sm font-medium"
            >
              View All Jobs
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Desktop dashboard component
  const DesktopDashboard = () => {
    const totalJobs = Object.values(jobStats).reduce((sum, stat) => sum + (stat.count || 0), 0);
    const completedJobs = jobStats.completed?.count || 0;
    const activeJobs = (jobStats.pending?.count || 0) + (jobStats.confirmed?.count || 0) + (jobStats['in-progress']?.count || 0);

    return (
      <div className="hidden md:block space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Client Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}. Manage your drone service projects.</p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiFileText className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Jobs</dt>
                    <dd className="text-lg font-medium text-gray-900">{activeJobs}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiCheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed Jobs</dt>
                    <dd className="text-lg font-medium text-gray-900">{completedJobs}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiFolder className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Jobs</dt>
                    <dd className="text-lg font-medium text-gray-900">{totalJobs}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Recent Jobs</h2>
            {jobs.length > 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
              >
                <FiPlus className="h-4 w-4 mr-2" />
                Create New Job
              </button>
            )}
          </div>
          <div className="p-6">
            {jobs.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Yet</h3>
                <p className="text-gray-500 mb-4">You haven&apos;t created any service requests yet.</p>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                  Create Your First Job
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 3).map((job) => {
                  const statusInfo = getStatusInfo(job.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div key={job._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <StatusIcon className={`h-5 w-5 text-${statusInfo.color}-500`} />
                        <div>
                          <p className="font-medium text-gray-900">{formatServiceType(job.service)}</p>
                          <p className="text-sm text-gray-500">{job.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(job.date).toLocaleDateString()}
                        </p>
                        <p className={`text-xs text-${statusInfo.color}-600`}>{statusInfo.text}</p>
                      </div>
                    </div>
                  );
                })}
                {jobs.length > 3 && (
                  <div className="text-center pt-3">
                    <button 
                      onClick={() => router.push('/dashboard?section=jobs')}
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                      View all {jobs.length} jobs
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Jobs List Component
  const JobsList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
          <p className="text-gray-600">Track and manage all your drone service requests.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium flex items-center"
        >
          <FiPlus className="h-4 w-4 mr-2" />
          Create New Job
        </button>
      </div>
      
      {loading ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading your jobs...</p>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-12">
            <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Yet</h3>
            <p className="text-gray-500">Create your first service request to get started.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => {
                  const statusInfo = getStatusInfo(job.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={job._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatServiceType(job.service)}
                          </div>
                          <div className="text-sm text-gray-500">{job.location}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(job.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${statusInfo.color}-100 text-${statusInfo.color}-800`}>
                          <StatusIcon className={`h-3 w-3 mr-1`} />
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {job.finalPrice || job.estimatedPrice ? `$${job.finalPrice || job.estimatedPrice}` : 'TBD'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              setShowJobDetail(true);
                            }}
                            className="text-blue-600 hover:text-blue-500 flex items-center"
                          >
                            <FiEye className="h-4 w-4 mr-1" />
                            View
                          </button>
                          {job.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedJob(job);
                                  setShowEditModal(true);
                                }}
                                className="text-gray-600 hover:text-gray-500"
                                title="Edit job"
                              >
                                <FiEdit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedJob(job);
                                  setShowDeleteConfirm(true);
                                }}
                                className="text-red-600 hover:text-red-500"
                                title="Delete job"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <MobileCompactDashboard />
            <DesktopDashboard />
          </div>
        );

      case 'jobs':
        return <JobsList />;

      case 'settings':
        return <Settings user={user} onUpdate={onUpdate} />;
      


      default:
        return (
          <div className="space-y-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Client Dashboard</h1>
              <p className="text-gray-600">Welcome to your client portal.</p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Section Not Found</h3>
                <p className="text-gray-500">The requested section could not be found.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-full">
      {renderContent()}
      {showCreateModal && <CreateJobModal />}
      {showJobDetail && <JobDetailModal />}
      {showEditModal && <EditJobModal />}
      {showDeleteConfirm && <DeleteConfirmModal />}
    </div>
  );
}