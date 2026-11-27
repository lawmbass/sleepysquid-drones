import { bookingHref } from '@/libs/manualBooking';
import ServiceArticle, {
  PageKicker,
  PageText,
  PageTitle,
  PriceRow,
  ScopeList,
  ServicePhoto,
} from '@/components/marketing/ServiceArticle';

export default function EventAerialsPage() {
  return (
    <ServiceArticle
      title="Event Aerials in Washington, DC, MD & VA | SleepySquid Drones"
      description="Event aerial photo and video in Washington, DC, Maryland, and Virginia. From $500, priced by event."
      path="/services/event-aerials"
    >
      <PageKicker>Washington, DC, Maryland, and Virginia</PageKicker>
      <PageTitle>Event Aerials</PageTitle>
      <PageText>
        Photo and video coverage for an event in Washington, DC, Maryland, or Virginia. Priced by event.
      </PageText>
      <ServicePhoto src="/images/service-events.jpg" alt="Aerial photo of an outdoor gathering" />
      <PriceRow
        name="Event coverage"
        price="From $500"
        detail="Priced by event."
        href={bookingHref('event-coverage', 'event-aerials')}
        cta="Book Event Aerials"
      />
      <ScopeList items={['Photo and video coverage', 'Priced by event']} />
    </ServiceArticle>
  );
}
