import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import ConnectedSourcesSection from "@/components/admin/ConnectedSourcesSection";
import { applyEnabled, previewPageAllowed, previewSources } from "@/libs/gigSources";

const STATES = ["green", "orange", "red", "disabled"];

export async function getServerSideProps(context) {
  if (!previewPageAllowed()) return { notFound: true };
  const requested = typeof context.query.state === "string" ? context.query.state : "green";
  const theme = context.query.theme === "light" ? "light" : "dark";
  return {
    props: {
      state: STATES.includes(requested) ? requested : "green",
      theme,
    },
  };
}

export default function ConnectedSourcesPreview({ state, theme }) {
  const base = useMemo(() => previewSources(state), [state]);
  const [sources, setSources] = useState(base);

  useEffect(() => {
    setSources(base);
  }, [base]);

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.toggle("dark", theme === "dark");
    return () => {
      root.classList.toggle("dark", hadDark);
    };
  }, [theme]);

  return (
    <>
      <Head>
        <title>Connected sources</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bot rules</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            Connected sources, shown in the {state} state for a visual check. This page is not the live
            admin list.
          </p>
          <div className="mt-6">
            <ConnectedSourcesSection
              controlled
              sources={sources}
              tableReady
              onToggle={(source, enabled) => {
                setSources((current) =>
                  current.map((row) => (row.key === source.key ? applyEnabled(row, enabled) : row))
                );
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
