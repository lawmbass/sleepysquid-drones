import Link from 'next/link';
import { bookingHref } from '@/libs/manualBooking';
import ServiceArticle, {
  PageHeading,
  PageKicker,
  PageText,
  PageTitle,
  PlainNote,
  PriceRow,
  ScopeList,
  ServicePhoto,
} from '@/components/marketing/ServiceArticle';

export default function RoofPropertyConditionPage() {
  return (
    <ServiceArticle
      title="Roof & Property Condition Photos in the DMV | SleepySquid Drones"
      description="Roof and property condition photos, $249 per structure, flat. 20–30 edited photos, 48-hour delivery. Photos only, not a licensed roof inspection."
      path="/services/roof-property-condition"
    >
      <PageKicker>Washington, DC, Maryland, and Virginia</PageKicker>
      <PageTitle>Roof &amp; Property Condition</PageTitle>
      <PageText>
        Edited photos of one structure in Washington, DC, Maryland, and Virginia. $249 per structure, flat.
      </PageText>
      <ServicePhoto src="/images/service-inspection.jpg" alt="Aerial photo of a house roof and yard" />

      <PriceRow
        name="One structure"
        price="$249"
        detail="Per structure, flat. 48-hour delivery."
        href={bookingHref('inspection', 'roof-property-condition')}
        cta="Book Roof & Property Condition"
      />

      <PageHeading>What is included</PageHeading>
      <ScopeList
        items={[
          '20–30 edited high-resolution photos of one structure',
          'Roof planes, ridges/valleys, gutters, flashing, chimneys/vents, and four-side elevations',
          'Labeled N/S/E/W in a download folder',
          '48-hour delivery',
          'Travel within 25 miles of Burtonsville, MD',
          'Commercial use license',
          'Certificate of Insurance ($1M liability) on request',
        ]}
      />

      <PlainNote>
        <PageText>Photos only — not a licensed roof inspection, damage diagnosis, claim opinion, thermal scan, or roof measurement report.</PageText>
        <PageText>Multi-building properties by quote; no towers, power lines, or utility infrastructure; return visits are a separate booking.</PageText>
        <PageText>Add-ons (raw files, next-day delivery, short video, extra travel) on request.</PageText>
      </PlainNote>
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
