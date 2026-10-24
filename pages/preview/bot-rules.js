import { useEffect, useMemo } from "react";
import Head from "next/head";
import BotRulesSection from "@/components/admin/BotRulesSection";
import { DEFAULT_BOT_SETTINGS } from "@/libs/botRules";
import { presentSources, previewPageAllowed } from "@/libs/gigSources";

const NOW = "2026-10-24T16:00:00.000Z";

function sampleSources() {
  return presentSources(
    [
      {
        sourceKey: "zeitview",
        displayName: "Zeitview",
        enabled: true,
        profileSyncAvailable: true,
        profileSyncResult: "ok",
        profileSyncAt: "2026-10-24T15:00:00.000Z",
        profileSyncObserved: {
          street: "11205 Keystone Ave",
          city: "Clinton",
          travel_distance: 100,
        },
      },
      {
        sourceKey: "flyguys",
        displayName: "FlyGuys",
        enabled: false,
        profileSyncAvailable: true,
        profileSyncRequestedAt: "2026-10-24T15:30:00.000Z",
      },
      {
        sourceKey: "droners",
        displayName: "Droners.io",
        enabled: true,
        profileSyncAvailable: true,
        profileSyncResult: "failed",
        profileSyncError: "Account Settings did not save.",
        profileSyncAt: "2026-10-24T15:00:00.000Z",
      },
    ],
    {
      live: {
        status: "ok",
        lastWatchError: null,
        watchExpiration: "2026-10-31T16:00:00.000Z",
        gmailPoll: {
          enabled: true,
          intervalMs: 300000,
          lastPollAt: "2026-10-24T15:58:00.000Z",
          lastPollResult: { ok: true, found: 1, queued: 0 },
        },
        acceptFailures: [],
        unclearAccepts: [],
        recentMissionOutcomes: [],
        zeitviewProfileSync: { state: "ok", lastResult: "ok", error: null, drift: false },
        driveTimeBackfill: { error: null, failed: 0 },
      },
      liveOk: true,
      now: new Date(NOW),
    }
  );
}

export async function getServerSideProps() {
  if (!previewPageAllowed()) return { notFound: true };
  return { props: {} };
}

export default function BotRulesPreview() {
  const sources = useMemo(() => sampleSources(), []);
  const settings = {
    ...DEFAULT_BOT_SETTINGS,
    travelRadiusAvailable: true,
    travelRadiusMiles: 100,
    updatedAt: NOW,
  };

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <>
      <Head>
        <title>Bot rules</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8">
          <BotRulesSection
            fixture={{
              settings,
              sources,
              tableReady: true,
            }}
          />
        </div>
      </div>
    </>
  );
}
