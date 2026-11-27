import { bookingHref } from '@/libs/manualBooking';
import ServiceArticle, {
  PageKicker,
  PageText,
  PageTitle,
  PriceRow,
  ScopeList,
  ServicePhoto,
} from '@/components/marketing/ServiceArticle';

export default function Mapping3dPage() {
  return (
    <ServiceArticle
      title="Mapping & 3D in Washington, DC, MD & VA | SleepySquid Drones"
      description="Mapping and 3D in Washington, DC, Maryland, and Virginia. From $900, by quote."
      path="/services/mapping-3d"
    >
      <PageKicker>Washington, DC, Maryland, and Virginia</PageKicker>
      <PageTitle>Mapping &amp; 3D</PageTitle>
      <PageText>
        Mapping and 3D for a site in Washington, DC, Maryland, or Virginia. By quote.
      </PageText>
      <ServicePhoto src="/images/service-mapping.jpg" alt="Aerial photo of land and roads" />
      <PriceRow
        name="Mapping and 3D"
        price="From $900"
        detail="By quote."
        href={bookingHref('mapping-surveying', 'mapping-3d')}
        cta="Book Mapping & 3D"
      />
      <ScopeList items={['By quote']} />
    </ServiceArticle>
  );
}
