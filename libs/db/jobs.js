import { listAllBookings } from "@/libs/db/bookings";
import { listUnlinkedAcceptedListings } from "@/libs/db/listings";
import { mergeJobs } from "@/libs/jobs";

export async function loadJobs() {
  const [bookings, listings] = await Promise.all([
    listAllBookings({}),
    listUnlinkedAcceptedListings(),
  ]);
  return mergeJobs(bookings, listings);
}
