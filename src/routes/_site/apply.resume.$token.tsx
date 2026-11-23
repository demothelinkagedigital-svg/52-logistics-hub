import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { getApplicationByToken } from "@/lib/public-application.functions";
import { ApplicationForm } from "@/components/application/ApplicationForm";
import { siteBootstrapQuery } from "../_site";
import { getPublicJobs } from "@/lib/public-content.functions";

export const Route = createFileRoute("/_site/apply/resume/$token")({
  ssr: false,
  loader: async ({ params, context }) => {
    const jobs = await getPublicJobs();
    context.queryClient.setQueryData(["public-jobs"], jobs);
    try {
      const application = await getApplicationByToken({ data: { token: params.token } });
      context.queryClient.setQueryData(["public-application", params.token], application);
      return true;
    } catch {
      return false;
    }
  },
  head: () => ({ meta: [
    { title: "Resume Your Application | 52 Logistics" },
    { name: "robots", content: "noindex" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  component: ResumeApplication,
});

function ResumeApplication() {
  const { token } = useParams({ from: "/_site/apply/resume/$token" });
  const validToken = Route.useLoaderData();
  const { data: settings } = useSuspenseQuery(siteBootstrapQuery);

  if (!validToken) {
    const email = settings.settings["recruiting_email"];
    return (
      <section className="container-page max-w-2xl py-20 lg:py-24">
        <p className="eyebrow text-accent">Application link unavailable</p>
        <h1 className="display-lg mt-4">This link is invalid or expired.</h1>
        <p className="mt-4 text-muted-foreground">Start a new application or contact recruiting for help.</p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link to="/apply" className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground">Start a new application</Link>
          {email ? <a className="text-sm font-medium underline" href={`mailto:${email}`}>{email}</a> : null}
        </div>
      </section>
    );
  }

  return <div className="container-page py-12 lg:py-16"><ApplicationForm token={token} /></div>;
}
