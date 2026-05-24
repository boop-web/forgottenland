import { createFileRoute } from "@tanstack/react-router";
import ForgottenlandGame from "@/components/ForgottenlandGame";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: ".forgottenland — Castle Defense" },
      { name: "description", content: "Defend your frozen kingdom. Collect gold, raise walls, command archers, crush the raiders." },
    ],
  }),
});

// IMPORTANT: Replace this placeholder. For sites with multiple pages (About, Services, Contact, etc.),
// create separate route files (about.tsx, services.tsx, contact.tsx) — don't put all pages in this file.
function Index() {
  return <ForgottenlandGame />;
}
