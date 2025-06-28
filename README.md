# SleepySquid Drones | Professional Drone Services Website

A modern, responsive website for professional drone services including aerial photography, videography, real estate photography, construction documentation, and specialized mapping services.

## 🚁 Features

- **Modern Design**: Clean, responsive design optimized for all devices
- **Interactive Portfolio**: Showcase of real drone work with image galleries and project details
- **Service Categories**: Real estate, construction, commercial, events, and mapping services
- **Pricing Plans**: Transparent pricing with different service tiers
- **Online Booking**: Integrated booking system with date/time selection
- **Contact Forms**: Easy client communication and quote requests
- **Performance Optimized**: Built with Next.js for fast loading and SEO

## 🛠️ Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **UI Components**: React with custom components
- **Form Handling**: React Hook Form
- **Date Selection**: React DatePicker
- **Icons**: React Icons

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd drone-sleepysquid
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
├── components/
│   ├── home/
│   │   ├── HeroSection.jsx       # Landing page hero
│   │   ├── ServicesSection.jsx   # Services overview
│   │   ├── PortfolioSection.jsx  # Project portfolio
│   │   ├── PricingSection.jsx    # Service pricing
│   │   ├── BookingSection.jsx    # Appointment booking
│   │   └── ContactSection.jsx    # Contact form
│   └── layout/
├── pages/
│   ├── index.js                  # Main homepage
│   └── _app.js                   # App configuration
├── public/
│   └── images/                   # Portfolio images
├── styles/                       # Global styles
└── ...
```

## 🎯 Core Sections

### Hero Section
- Professional landing with call-to-action
- Service highlights and value proposition

### Services
- Aerial Photography & Videography
- Real Estate Documentation  
- Construction Progress Tracking
- Commercial & Industrial Inspections
- Event Coverage
- Mapping & Surveying

### Portfolio
- Real project showcases
- Image galleries with captions
- Filterable by service category
- Modal viewing with navigation

### Pricing
- Transparent service pricing
- Multiple service tiers
- Custom quote options

### Booking System
- Calendar integration
- Service selection
- Contact information collection
- Availability management

## 🔧 Customization

### Adding Portfolio Items

Edit `components/home/PortfolioSection.jsx` and add new items to the `portfolioItems` array:

```javascript
{
  id: 106,
  title: 'Your Project Name',
  category: 'real-estate',
  image: '/images/your-image.jpg',
  description: 'Project description',
  gallery: [
    {
      src: '/images/image1.jpg',
      caption: 'Image description'
    }
  ]
}
```

### Updating Services

Modify `components/home/ServicesSection.jsx` to add or edit service offerings.

### Pricing Changes

Update pricing in `components/home/PricingSection.jsx`.

## 📱 Mobile Responsive

The website is fully responsive and optimized for:
- Desktop (1200px+)
- Tablet (768px - 1199px)  
- Mobile (320px - 767px)

## 🔍 SEO Ready

- Meta tags configured
- Semantic HTML structure
- Performance optimized
- Mobile-friendly design

## 📄 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For questions or support regarding this website:
- Create an issue in the repository
- Contact the development team

---

Built with ❤️ for professional drone services
