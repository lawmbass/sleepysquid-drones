import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const portfolioItems = [
  {
    id: 105,
    title: 'Waterfront Estate & Community',
    category: 'real-estate',
    image: '/images/waterfront-estate-front-entrance.jpg',
    description: 'Comprehensive aerial photography showcasing a luxury waterfront estate and the surrounding community with private docks, water access, and scenic coastal living.',
    gallery: [
      {
        src: '/images/waterfront-estate-front-entrance.jpg',
        caption: 'Grand front entrance of the waterfront estate featuring stone accents, multiple gables, and circular driveway with professional landscaping.'
      },
      {
        src: '/images/waterfront-estate-rear-deck.jpg',
        caption: 'Rear view of the estate showcasing the expansive deck, outdoor living spaces, and convenient kayak storage underneath.'
      },
      {
        src: '/images/waterfront-community-docks.jpg',
        caption: 'Aerial view of the waterfront community highlighting private docks, boat slips, and direct water access for residents.'
      },
      {
        src: '/images/waterfront-neighborhood-aerial.jpg',
        caption: 'Neighborhood aerial perspective showing the variety of homes and their relationship to the waterfront amenities.'
      },
      {
        src: '/images/waterfront-community-overview.jpg',
        caption: 'Community overview capturing the layout of homes, docks, and the natural waterfront setting with tree-lined shores.'
      },
      {
        src: '/images/waterfront-home-deck-view.jpg',
        caption: 'Waterfront home featuring prominent deck structures and recreational amenities with kayaks and outdoor equipment.'
      },
      {
        src: '/images/waterfront-property-dock-access.jpg',
        caption: 'Property showcase with direct dock access, demonstrating the seamless indoor-outdoor waterfront lifestyle.'
      },
      {
        src: '/images/waterfront-community-wide-view.jpg',
        caption: 'Wide aerial perspective of the entire waterfront community showing the extensive water access and community layout.'
      },
      {
        src: '/images/waterfront-community-panoramic.jpg',
        caption: 'Panoramic aerial view capturing the full scope of the waterfront development and surrounding natural landscape.'
      },
      {
        src: '/images/waterfront-community-complete-aerial.jpg',
        caption: 'Complete aerial overview showing the relationship between individual properties and the broader community infrastructure.'
      }
    ]
  },
  {
    id: 104,
    title: 'Residential Construction Complex',
    category: 'construction',
    image: '/images/construction-complex-aerial-overview.jpg',
    description: 'Comprehensive aerial documentation of a large-scale residential construction project featuring apartment buildings and townhomes throughout various construction phases.',
    gallery: [
      {
        src: '/images/construction-complex-aerial-overview.jpg',
        caption: 'Aerial overview of the residential construction complex showing multiple apartment buildings and townhomes under construction.'
      },
      {
        src: '/images/construction-complex-angle-view.jpg',
        caption: 'Angled perspective capturing the scale and layout of the multi-building residential development project.'
      },
      {
        src: '/images/construction-complex-roadside-view.jpg',
        caption: 'Roadside aerial view showcasing the construction site accessibility and proximity to main transportation routes.'
      },
      {
        src: '/images/construction-complex-forest-view.jpg',
        caption: 'Construction site captured with the surrounding forest backdrop, highlighting the natural setting of the development.'
      },
      {
        src: '/images/construction-complex-wide-angle.jpg',
        caption: 'Wide-angle aerial shot displaying the full scope and scale of the residential construction project.'
      },
      {
        src: '/images/construction-complex-progress-aerial.jpg',
        caption: 'Construction progress documentation showing various phases of building completion across the site.'
      },
      {
        src: '/images/construction-complex-detailed-view.jpg',
        caption: 'Detailed aerial view focusing on specific building structures and construction methodologies.'
      },
      {
        src: '/images/construction-complex-infrastructure.jpg',
        caption: 'Infrastructure development capture showing road construction, utilities, and site preparation work.'
      },
      {
        src: '/images/construction-complex-buildings-progress.jpg',
        caption: 'Building construction progress showing framing, roofing, and exterior work phases.'
      },
      {
        src: '/images/construction-complex-roofing-phase.jpg',
        caption: 'Roofing construction phase captured from above, showing the dark roof installations across multiple buildings.'
      },
      {
        src: '/images/construction-complex-site-layout.jpg',
        caption: 'Overall site layout perspective showing the organized arrangement of buildings and construction zones.'
      },
      {
        src: '/images/construction-complex-courtyard-view.jpg',
        caption: 'Courtyard and common areas between building complexes showing thoughtful community planning.'
      },
      {
        src: '/images/construction-complex-elevated-perspective.jpg',
        caption: 'Elevated perspective capturing the relationship between different building phases and site organization.'
      },
      {
        src: '/images/construction-complex-completion-stage.jpg',
        caption: 'Later construction stage showing buildings nearing completion with finished roofing and exterior work.'
      },
      {
        src: '/images/construction-complex-final-aerial.jpg',
        caption: 'Final construction phase aerial view showing the completed building structures and site development.'
      },
      {
        src: '/images/construction-complex-comprehensive-view.jpg',
        caption: 'Comprehensive site view capturing the entire development from completion to ongoing construction areas.'
      },
      {
        src: '/images/construction-complex-townhomes-aerial.jpg',
        caption: 'Aerial perspective of the townhome section of the complex showing individual unit construction and layout.'
      },
      {
        src: '/images/construction-complex-multi-building.jpg',
        caption: 'Multi-building aerial showing the coordinated construction of apartment complexes and community facilities.'
      },
      {
        src: '/images/construction-complex-project-overview.jpg',
        caption: 'Complete project overview from aerial perspective showing the full scale and impact of the residential development.'
      }
    ]
  },
  {
    id: 101,
    title: 'Riverside Real Estate Aerials',
    category: 'real-estate',
    image: '/images/riverside-job-100ft-1.jpg',
    description: 'Aerial photography job showcasing a riverside neighborhood, marina, and surrounding landscape at multiple altitudes.',
    gallery: [
      {
        src: '/images/riverside-job-100ft-1.jpg',
        caption: 'Aerial view of a riverside residential area at 100ft, highlighting the proximity to water and lush greenery.'
      },
      {
        src: '/images/riverside-job-100ft-2.jpg',
        caption: 'Drone shot looking northeast at 100ft, capturing homes, open lots, and the scenic waterfront.'
      },
      {
        src: '/images/riverside-job-350ft-1.jpg',
        caption: 'Expansive aerial perspective of the neighborhood and marina at 350ft, showing the full landscape and water access.'
      },
      {
        src: '/images/riverside-job-350ft-2.jpg',
        caption: 'High-altitude northeast-facing drone image at 350ft, featuring the community, marina, and surrounding forest.'
      }
    ]
  },
  {
    id: 102,
    title: 'Suburban Family Home Aerials',
    category: 'real-estate',
    image: '/images/suburban-front.jpg',
    description: 'Aerial photography job featuring a suburban family home and its neighborhood, highlighting the property, backyard deck, and surrounding greenery.',
    gallery: [
      {
        src: '/images/suburban-front.jpg',
        caption: 'Front aerial view of the home and neighborhood, showing the property and tree-lined street.'
      },
      {
        src: '/images/suburban-backyard.jpg',
        caption: 'Backyard aerial view focusing on the home\'s deck, patio furniture, and lush green yard.'
      },
      {
        src: '/images/suburban-topdown.jpg',
        caption: 'Top-down view of the property and adjacent homes, capturing the spacious lot and landscaping.'
      }
    ]
  },
  {
    id: 103,
    title: 'Marina & Waterfront Complex',
    category: 'real-estate',
    image: '/images/marina-topdown.jpg',
    description: 'Comprehensive aerial photography of a waterfront marina complex, showcasing boat slips, facilities, and coastal access with stunning water views.',
    gallery: [
      {
        src: '/images/marina-topdown.jpg',
        caption: 'Top-down aerial view of the marina complex showing boat slips, parking areas, and facility layout.'
      },
      {
        src: '/images/marina-midlevel.jpg',
        caption: 'Mid-level perspective capturing the marina facilities, docks, and surrounding waterfront landscape.'
      },
      {
        src: '/images/marina-bridge.jpg',
        caption: 'Aerial view featuring the marina with connecting bridges and extensive dock systems.'
      },
      {
        src: '/images/marina-waterfront.jpg',
        caption: 'Waterfront aerial showcasing the marina\'s relationship to the surrounding community and water access.'
      },
      {
        src: '/images/marina-coastal.jpg',
        caption: 'Coastal perspective highlighting the marina\'s ocean access and beachfront facilities.'
      }
    ]
  },
  // {
  //   id: 1,
  //   title: 'Coastal Real Estate',
  //   category: 'real-estate',
  //   image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2670&auto=format&fit=crop',
  //   description: 'Aerial photography showcasing luxury beachfront properties'
  // },
  // {
  //   id: 2,
  //   title: 'Mountain Wedding',
  //   category: 'events',
  //   image: 'https://images.unsplash.com/photo-1519750783826-e2420f4d687f?q=80&w=2574&auto=format&fit=crop',
  //   description: 'Capturing the magic of a mountain-top wedding ceremony'
  // },
  // {
  //   id: 3,
  //   title: 'Construction Progress',
  //   category: 'commercial',
  //   image: 'https://images.unsplash.com/photo-1590856029826-c7a73142bbf1?q=80&w=2670&auto=format&fit=crop',
  //   description: 'Monthly progress tracking for large construction project'
  // },
  // {
  //   id: 4,
  //   title: 'Agricultural Mapping',
  //   category: 'mapping',
  //   image: 'https://images.unsplash.com/photo-1569983178481-f0c7bcdc745e?q=80&w=2670&auto=format&fit=crop',
  //   description: 'Detailed crop analysis and irrigation planning for local farm'
  // },
  // {
  //   id: 5,
  //   title: 'Solar Panel Inspection',
  //   category: 'inspection',
  //   image: 'https://images.unsplash.com/photo-1611273426858-450e7f08d0bf?q=80&w=2574&auto=format&fit=crop',
  //   description: 'Thermal imaging inspection of commercial solar installation'
  // },
  // {
  //   id: 6,
  //   title: 'Waterfall Adventure',
  //   category: 'creative',
  //   image: 'https://images.unsplash.com/photo-1455577380025-4321f1e1dca7?q=80&w=2670&auto=format&fit=crop',
  //   description: 'Dynamic footage following hikers to remote waterfall'
  // },
  // {
  //   id: 7,
  //   title: 'Urban Development',
  //   category: 'commercial',
  //   image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=2670&auto=format&fit=crop',
  //   description: '3D modeling of downtown area for city planning'
  // },
  // {
  //   id: 8,
  //   title: 'Music Festival',
  //   category: 'events',
  //   image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=2670&auto=format&fit=crop',
  //   description: 'Aerial coverage of summer music festival with 10,000+ attendees'
  // }
];

const categories = [
  { id: 'all', name: 'All Work' },
  { id: 'real-estate', name: 'Real Estate' },
  { id: 'construction', name: 'Construction' }
];

const PortfolioSection = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const filteredItems = activeCategory === 'all' 
    ? portfolioItems 
    : portfolioItems.filter(item => item.category === activeCategory);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
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

  // Reset gallery index when opening a new modal
  React.useEffect(() => {
    setGalleryIndex(0);
    
    // Initial setup - will be handled by main effect
  }, [selectedItem]);



    // Handle thumbnail scrolling
  React.useEffect(() => {
    if (!selectedItem?.gallery || galleryIndex === null) return;
    
    // Small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      const container = document.querySelector('.thumbnail-container');
      const activeThumb = document.querySelector(`[data-thumbnail-index="${galleryIndex}"]`);
      
      if (!container || !activeThumb) return;
    
      const isMobile = window.innerWidth <= 768;
      const isOverflowing = container.scrollWidth > container.clientWidth;
      
      // Calculate scroll position for active thumbnail
      const containerWidth = container.offsetWidth;
      const thumbLeft = activeThumb.offsetLeft;
      const thumbWidth = activeThumb.offsetWidth;
      const maxScroll = container.scrollWidth - containerWidth;
      const currentIndex = parseInt(activeThumb.getAttribute('data-thumbnail-index'));
      const totalImages = selectedItem.gallery.length;
      
      let targetScroll;
      
      if (currentIndex <= 2) {
        targetScroll = 0;
      } else if (currentIndex >= totalImages - 3) {
        targetScroll = maxScroll;
      } else {
        targetScroll = thumbLeft - (containerWidth / 2) + (thumbWidth / 2);
        targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
      }
      
      // Scroll to show active thumbnail
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
      
      // Add overflow class for desktop styling if needed
      if (!isMobile && isOverflowing) {
        container.classList.add('overflow');
      } else if (!isMobile) {
        container.classList.remove('overflow');
      }
    }, 50);
    
    return () => {
      clearTimeout(timer);
    };
  }, [galleryIndex, selectedItem]);

  // Keyboard navigation for modal
  React.useEffect(() => {
    const handleKeyPress = (event) => {
      if (!selectedItem) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          if (selectedItem.gallery && selectedItem.gallery.length > 1) {
            event.preventDefault();
            setGalleryIndex((prev) => 
              prev === 0 ? selectedItem.gallery.length - 1 : prev - 1
            );
          }
          break;
        case 'ArrowRight':
          if (selectedItem.gallery && selectedItem.gallery.length > 1) {
            event.preventDefault();
            setGalleryIndex((prev) => 
              prev === selectedItem.gallery.length - 1 ? 0 : prev + 1
            );
          }
          break;
        case 'Escape':
          event.preventDefault();
          setSelectedItem(null);
          break;
        default:
          break;
      }
    };

    if (selectedItem) {
      document.addEventListener('keydown', handleKeyPress);
      // Prevent body scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      // Restore body scrolling when modal closes
      document.body.style.overflow = 'unset';
    };
  }, [selectedItem, galleryIndex]);

  return (
    <section id="portfolio" className="py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Portfolio</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Browse our collection of stunning drone photography and videography projects
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Portfolio Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center text-red-500 text-lg py-12">
            No portfolio items found for this category.
          </div>
        ) : (
          <motion.div 
            ref={ref}
            variants={containerVariants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {filteredItems.map(item => (
              <PortfolioItem 
                key={item.id} 
                item={item} 
                variants={itemVariants} 
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </motion.div>
        )}

        {/* Modal for Portfolio Item */}
        {selectedItem && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              // Close modal if clicking on backdrop (not on modal content)
              if (e.target === e.currentTarget) {
                setSelectedItem(null);
              }
            }}
          >
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] md:overflow-auto md:flex-none flex flex-col">
              <div className="relative md:static md:flex-none flex-1 min-h-0">
                {selectedItem.gallery ? (
                  <div className="w-full md:flex md:flex-col md:items-center h-full md:h-auto flex flex-col">
                    {/* Large main image with arrows */}
                    <div className="relative w-full bg-black flex items-center justify-center mb-2 md:mb-4 flex-1 md:flex-none min-h-0 md:min-h-[200px] md:max-h-[55vh]">
                      <button
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 z-10 hover:bg-opacity-100"
                        onClick={() => setGalleryIndex((galleryIndex - 1 + selectedItem.gallery.length) % selectedItem.gallery.length)}
                        aria-label="Previous image"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <img
                        src={selectedItem.gallery[galleryIndex].src}
                        alt={selectedItem.gallery[galleryIndex].caption}
                        onError={e => { e.target.src = 'https://via.placeholder.com/800x600?text=Image+Unavailable'; }}
                        className="w-full h-full md:h-auto md:max-h-[55vh] object-contain rounded-t-xl"
                      />
                      {/* Overlayed caption */}
                      <div className="absolute bottom-0 left-0 w-full bg-black bg-opacity-60 text-white text-sm p-3">
                        {selectedItem.gallery[galleryIndex].caption}
                      </div>
                      <button
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 z-10 hover:bg-opacity-100"
                        onClick={() => setGalleryIndex((galleryIndex + 1) % selectedItem.gallery.length)}
                        aria-label="Next image"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                    {/* Thumbnails */}
                    <div className="w-full px-4 py-2 md:mb-2 flex-shrink-0">
                      <div className="thumbnail-container relative flex gap-2 scrollbar-hide md:pb-2">
                        {selectedItem.gallery.map((img, idx) => (
                          <button
                            key={idx}
                            data-thumbnail-index={idx}
                            className={`flex-shrink-0 border-2 ${galleryIndex === idx ? 'border-blue-500' : 'border-transparent'} rounded-md p-0.5 focus:outline-none transition-all duration-200`}
                            onClick={() => setGalleryIndex(idx)}
                            aria-label={`Show image ${idx + 1}`}
                          >
                            <img
                              src={img.src}
                              alt={img.caption}
                              className={`w-12 h-9 md:w-14 md:h-10 object-cover rounded transition-all duration-200 ${galleryIndex === idx ? 'ring-2 ring-blue-500 scale-105' : 'hover:scale-105'}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.title}
                    className="w-full h-full md:h-auto md:max-h-[55vh] object-contain rounded-t-xl"
                  />
                )}
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg z-20"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              <div className="p-4 md:p-6 flex-shrink-0 md:flex-none md:border-t-0 border-t border-gray-100">
                <h3 className="text-xl md:text-2xl font-bold mb-2">{selectedItem.title}</h3>
                <p className="text-gray-600 mb-3 md:mb-4 text-sm md:text-base">{selectedItem.description}</p>
                <div className="flex items-center justify-between">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {categories.find(c => c.id === selectedItem.category).name}
                  </span>
                  {selectedItem.gallery && selectedItem.gallery.length > 1 && (
                    <div className="text-xs text-gray-400 hidden md:block">
                      Use ← → keys to navigate • Scroll thumbnails below • Press ESC to close
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const PortfolioItem = ({ item, variants, onClick }) => {
  // Add error handling for image loading
  const handleImageError = (e) => {
    e.target.src = 'https://via.placeholder.com/400x300?text=Image+Unavailable'; // Use a public placeholder image if the main image fails
  };

  return (
    <motion.div 
      variants={variants}
      className="group relative overflow-hidden rounded-lg shadow-md cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-w-4 aspect-h-3 h-48">
        <img 
          src={item.image} 
          alt={item.title} 
          onError={handleImageError}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <h3 className="text-white text-lg font-bold">{item.title}</h3>
        <p className="text-white/80 text-sm">{item.description}</p>
      </div>
    </motion.div>
  );
};

export default PortfolioSection; 