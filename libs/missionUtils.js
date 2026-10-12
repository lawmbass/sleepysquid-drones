import { loadJobs } from "@/libs/db/jobs";
import { filterJobs, summarizeAnalytics } from "@/libs/jobs";

/**
 * Mission and booking analytics from the shared job list.
 */
export async function getMissionAnalytics(filters = {}) {
  const jobs = filterJobs(await loadJobs(), {
    source: filters.source,
    status: filters.status,
    dateFrom: filters.startDate || filters.dateFrom,
    dateTo: filters.endDate || filters.dateTo,
    missionsOnly: filters.missionsOnly,
  });
  const report = summarizeAnalytics(jobs);
  return {
    totalMissions: report.summary.totalJobs,
    totalPayout: report.summary.totalRevenue,
    avgPayout: report.summary.averageJobValue,
    avgTravelDistance: report.summary.avgTravelDistance,
    avgTravelTime: report.summary.avgTravelTime,
    statusCounts: report.summary.statusCounts,
  };
}
