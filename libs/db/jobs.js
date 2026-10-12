import { listAllBookings } from "@/libs/db/bookings";
import { listLinkedAcceptedListings, listUnlinkedAcceptedListings } from "@/libs/db/listings";
import { mergeJobs } from "@/libs/jobs";

export async function loadJobs() {
  const [bookings, listings, linkedListings] = await Promise.all([
    listAllBookings({}),
    listUnlinkedAcceptedListings(),
    listLinkedAcceptedListings(),
  ]);
  return mergeJobs(bookings, listings, linkedListings);
}
