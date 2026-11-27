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

export default function ConstructionProgressPage() {
  return (
    <ServiceArticle
      title="Construction Progress Photos in Washington, DC, MD & VA | SleepySquid Drones"
      description="Construction progress photos in the DMV. $350 per visit, $650 per month for 2 visits, or $1,200 per month for 4 visits."
      path="/services/construction-progress"
    >
      <PageKicker>Washington, DC, Maryland, and Virginia</PageKicker>
      <PageTitle>Construction Progress</PageTitle>
      <PageText>
        Repeatable progress photos in Washington, DC, Maryland, and Virginia, from the same GPS points and altitudes, plus one overhead overview.
      </PageText>
      <ServicePhoto src="/images/construction-complex-progress-aerial.jpg" alt="Aerial photo of a construction site" />

      <PriceRow
        name="Single visit"
        price="$350/visit"
        href={bookingHref('inspection', 'construction-single-visit')}
        cta="Book a visit"
      />
      <PriceRow
        name="2 visits/mo"
        price="$650/mo"
        href={bookingHref('inspection', 'construction-monthly-2')}
        cta="Book 2 visits/mo"
      />
      <PriceRow
        name="4 visits/mo"
        price="$1,200/mo"
        href={bookingHref('inspection', 'construction-monthly-4')}
        cta="Book 4 visits/mo"
      />

      <PageHeading>What is included</PageHeading>
      <ScopeList
        items={[
          '20–30 edited photos per visit from repeatable GPS points and altitudes',
          '1 overhead overview',
          'Dated download folder within 48 hours',
          'Commercial use license',
          'Certificate of Insurance ($1M liability) on request',
        ]}
      />
    </ServiceArticle>
  );
}
