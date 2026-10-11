import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { listListings, listingAggregates } from "@/libs/db/listings";

const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    adminRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: "Rate limit exceeded",
          message: "Too many admin requests. Please wait before trying again.",
        });
        return reject(result);
      }
      resolve();
    });
  });
};

export default async function handler(req, res) {
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed", message: "Only GET requests are allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized", message: "Authentication required. Please sign in." });
  }
  if (!adminConfig.isAdmin(session.user.email)) {
    return res.status(403).json({ error: "Forbidden", message: "Admin access required. Insufficient permissions." });
  }

  try {
    const {
      status,
      mission_type: missionType,
      equipment,
      source,
      payout_min: payoutMin,
      payout_max: payoutMax,
      distance_max: distanceMax,
      date_from: dateFrom,
      date_to: dateTo,
      search,
      sort = "-lastSeenAt",
      limit = 25,
      page = 1,
    } = req.query;

    const filters = {
      status,
      missionType,
      equipment,
      source,
      payoutMin,
      payoutMax,
      distanceMax,
      dateFrom,
      dateTo,
      search,
    };
    const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const [{ listings, count }, aggregates] = await Promise.all([
      listListings(filters, { sort, limit: limitNum, offset }),
      listingAggregates(filters),
    ]);

    const totalPages = Math.max(Math.ceil(count / limitNum), 1);

    return res.status(200).json({
      success: true,
      data: {
        listings,
        aggregates,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount: count,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        filters,
      },
    });
  } catch (error) {
    console.error("Admin listings fetch error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch mission listings",
    });
  }
}
