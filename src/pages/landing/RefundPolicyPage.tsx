import Navbar from "./Navbar.tsx";
import Footer from "./Footer.tsx";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-6 prose prose-invert prose-sm">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: March 30, 2026
          </p>

          <section className="space-y-4 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3">
            <h2>1. Subscription Cancellation</h2>
            <p>
              You may cancel your paid subscription at any time from your
              account settings. When you cancel:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Your subscription remains active until the end of your current
                billing period.
              </li>
              <li>
                You will not be charged for any subsequent billing cycles.
              </li>
              <li>
                After the billing period ends, your account will be downgraded
                to the Free tier. Your data is preserved, but features beyond
                the Free tier will no longer be accessible.
              </li>
            </ul>

            <h2>2. Refund Policy</h2>
            <p>
              All sales are final. Because GroundWork is a digital subscription
              service with immediate access upon payment, we do not offer
              refunds for any subscription period that has already begun. We
              encourage you to take advantage of the Free tier to evaluate the
              Service before purchasing a paid subscription.
            </p>

            <h2>3. Free Tier</h2>
            <p>
              The Free tier is available at no cost and does not involve any
              billing. No refund policy applies to the Free tier.
            </p>

            <h2>4. Plan Changes</h2>
            <p>
              If you upgrade or downgrade your plan mid-cycle, the change
              takes effect at the start of your next billing period. You will
              continue to have access to your current plan's features until
              the end of the current billing cycle.
            </p>

            <h2>5. Contact</h2>
            <p>
              For billing questions, reach out to:
            </p>
            <ul className="list-none pl-0 space-y-1">
              <li>
                Email:{" "}
                <a
                  href="mailto:groundwork@teezfpo.com"
                  className="text-primary hover:underline"
                >
                  groundwork@teezfpo.com
                </a>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
