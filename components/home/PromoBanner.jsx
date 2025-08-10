import { useState, useEffect } from 'react';
import { FiGift, FiX } from 'react-icons/fi';

export default function PromoBanner() {
  const [activePromo, setActivePromo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
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
          setIsVisible(true);
        }
      }
    } catch (error) {
      console.error('Error fetching active promo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (loading || !activePromo || !isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-3">
            <FiGift className="h-5 w-5 text-yellow-300" />
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg">{activePromo.discountPercentage}% OFF</span>
              <span className="hidden sm:inline">- {activePromo.name}</span>
            </div>
            <span className="hidden md:inline text-sm opacity-90">
              {activePromo.description}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm opacity-90 hidden sm:inline">
              Valid until {new Date(activePromo.endDate).toLocaleDateString()}
            </span>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close promo banner"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}