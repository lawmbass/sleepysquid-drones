import Link from 'next/link';
import { bookingHref } from '@/libs/manualBooking';
import ServiceArticle, {
  PageHeading,
  PageKicker,
  PageText,
  PageTitle,
  PriceRow,
  ScopeList,
  ServicePhoto,
} from '@/components/marketing/ServiceArticle';

export default function RealEstateDronePhotographyPage() {
  return (
    <ServiceArticle
      title="Real Estate Drone Photography in Washington, DC, MD & VA | SleepySquid Drones"
      description="Listing photos for $199 and listing photos with video for $399. 48-hour delivery. Travel within 25 miles of Burtonsville, MD."
      path="/services/real-estate-drone-photography"
    >
      <PageKicker>Washington, DC, Maryland, and Virginia</PageKicker>
      <PageTitle>Real Estate Drone Photography</PageTitle>
      <PageText>
        Listing photos, and listing photos with a short video, for properties in Washington, DC, Maryland, and Virginia.
      </PageText>
      <ServicePhoto src="/images/service-real-estate.jpg" alt="Aerial photo of a residential property" />

      <PriceRow
        name="Listing Photos"
        price="$199"
        detail="48-hour delivery."
        href={bookingHref('real-estate', 'listing-photos')}
        cta="Book Listing Photos"
      />
      <PriceRow
        name="Listing Photos + Video"
        price="$399"
        detail="Best for listings. 48-hour delivery."
        href={bookingHref('aerial-media', 'listing-video')}
        cta="Book Listing Photos + Video"
      />

      <PageHeading>What is included</PageHeading>
      <ScopeList
        items={[
          '15-20 edited photos',
          'Short edited video up to 2 min on Listing Photos + Video',
          '48-hour delivery',
          'Travel within 25 miles of Burtonsville, MD',
        ]}
      />
      <PageText>
        Airspace is checked separately from the drive.{' '}
        <Link href="/dc-frz-airspace" className="text-blue-600 underline dark:text-blue-400">
          DC FRZ and SFRA
        </Link>
        .
      </PageText>
    </ServiceArticle>
  );
}
