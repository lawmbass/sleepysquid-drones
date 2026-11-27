import Link from 'next/link';
import ServiceArticle, {
  PageHeading,
  PageKicker,
  PageText,
  PageTitle,
} from '@/components/marketing/ServiceArticle';

export default function DcFrzAirspacePage() {
  return (
    <ServiceArticle
      title="Washington, DC FRZ & SFRA Airspace | SleepySquid Drones"
      description="How SleepySquid handles the Washington, DC Flight Restricted Zone and Special Flight Rules Area. Routine suburb flights versus authorization and lead time closer to DC."
      path="/dc-frz-airspace"
    >
      <PageKicker>Washington, DC, Maryland, and Virginia</PageKicker>
      <PageTitle>Washington, DC Flight Restricted Zone and Special Flight Rules Area</PageTitle>
      <PageText>
        SleepySquid Drones flies in the Washington, DC area. Some of that area is ordinary Part 107 airspace. Some of it is not. This page explains the difference. It is not an FAA authorization, and it does not clear a specific address.
      </PageText>

      <PageHeading>Routine flights</PageHeading>
      <PageText>
        Jobs in flyable Maryland and Virginia suburbs are scheduled as normal Part 107 flights. The address is still checked before a date is confirmed, because the rules depend on the exact point.
      </PageText>

      <PageHeading>The Flight Restricted Zone (FRZ)</PageHeading>
      <PageText>
        Washington, DC sits inside a Flight Restricted Zone. The FRZ is the inner area in 14 CFR 93.335, an irregular boundary about 13 to 15 nautical miles from the DCA VOR. A routine booking does not include a flight inside the FRZ.
      </PageText>
      <PageText>
        A flight inside the FRZ needs airspace authorization before any date is set. The request is made ahead of time, and approval is not guaranteed. SleepySquid does not offer same-day flights inside the FRZ.
      </PageText>

      <PageHeading>The Special Flight Rules Area (SFRA)</PageHeading>
      <PageText>
        The SFRA is the wider area, 30 nautical miles around the DCA VOR, and it contains the FRZ. A site can be in the SFRA and still outside the FRZ. Those flights follow Part 107 plus the rules for that location. Some need an airspace authorization and extra lead time. That is not the special FRZ authorization.
      </PageText>

      <PageHeading>How a date gets confirmed</PageHeading>
      <PageText>
        Send the address. SleepySquid checks whether it is in the FRZ, in the SFRA outside the FRZ, or in flyable suburb airspace. If authorization is required, the flight date waits until that authorization is approved.
      </PageText>
      <PageText>
        Travel distance, including jobs within 25 miles of Burtonsville, MD, is separate from airspace. A short drive can still land inside the SFRA or the FRZ.
      </PageText>

      <PageHeading>Official reference</PageHeading>
      <PageText>
        <a
          href="https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-93/subpart-V/section-93.335"
          className="text-blue-600 underline dark:text-blue-400"
          rel="noopener noreferrer"
          target="_blank"
        >
          14 CFR 93.335
        </a>
        {' '}defines the Washington, DC FRZ and SFRA. Confirm a location in B4UFLY or a LAANC app before flying. This page is a guide for customers, not a clearance.
      </PageText>
      <PageText>
        <Link href="/#booking" className="text-blue-600 underline dark:text-blue-400">
          Back to the booking form
        </Link>
      </PageText>
    </ServiceArticle>
  );
}
