import { useEffect } from "react";
import Head from "next/head";
import ReferralsSection from "@/components/admin/ReferralsSection";
import { previewPageAllowed } from "@/libs/gigSources";

export async function getServerSideProps(context) {
  if (!previewPageAllowed()) return { notFound: true };
  const state = context.query.state === "empty" ? "empty" : "ready";
  return { props: { state, confirmOpen: context.query.confirm === "1", editOpen: context.query.edit === "1" } };
}

export default function ReferralsPreview({ state, confirmOpen, editOpen }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <>
      <Head>
        <title>Referrals</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8">
          <ReferralsSection preview state={state} confirmOpen={confirmOpen} editOpen={editOpen} />
        </div>
      </div>
    </>
  );
}
