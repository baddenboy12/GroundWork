import Navbar from "./Navbar.tsx";
import Footer from "./Footer.tsx";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-6 prose prose-invert prose-sm">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: March 30, 2026
          </p>

          <section className="space-y-4 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-foreground [&_h3]:font-medium [&_h3]:mt-4">
            <h2>1. Introduction</h2>
            <p>
              GroundWork ("we", "our", or "us") operates the GroundWork web
              application and mobile app (the "Service"). This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our Service.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>Account Information</h3>
            <p>
              When you create an account, we collect your name, email address,
              and authentication credentials managed through our identity
              provider (Keycloak). We do not store passwords directly.
            </p>

            <h3>Log Data</h3>
            <p>
              When you use GroundWork, you may create site inspection logs that
              include text entries, photos, GPS coordinates, timestamps, and
              other metadata you choose to provide. This content is stored
              securely in our cloud database.
            </p>

            <h3>Photos</h3>
            <p>
              Photos you upload are stored in cloud object storage
              (Cloudflare R2). Photos are compressed client-side before upload
              to reduce storage usage. Photos are associated with your account
              and the logs you create.
            </p>

            <h3>Location Data</h3>
            <p>
              With your permission, we collect GPS coordinates to associate with
              your sites and log entries. You can deny location access at any
              time through your browser or device settings.
            </p>

            <h3>Payment Information</h3>
            <p>
              Payment processing is handled by our third-party payment
              processor (Stripe). We do not store your credit card numbers or
              bank account details. We receive only transaction confirmations
              and subscription status from Stripe.
            </p>

            <h3>Usage Data</h3>
            <p>
              We automatically collect certain information when you access the
              Service, including your browser type, device type, IP address,
              and general usage patterns.
            </p>

            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your transactions and manage subscriptions</li>
              <li>Send transactional emails (account verification, billing)</li>
              <li>Respond to your support requests</li>
              <li>Generate export files (PDF, Excel, CSV) at your request</li>
              <li>Enforce our Terms of Service</li>
            </ul>

            <h2>4. Data Sharing</h2>
            <p>
              We do not sell your personal information. We share data only in
              these limited circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Team members:</strong> If you join a team, other team
                members can see shared site and log data within that team.
              </li>
              <li>
                <strong>Service providers:</strong> We use third-party services
                (Convex for database, Cloudflare R2 for file storage, Stripe
                for payments, Keycloak for authentication) that process data
                on our behalf.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose information
                if required by law or to protect our rights.
              </li>
            </ul>

            <h2>5. Data Security</h2>
            <p>
              All data is transmitted over HTTPS. Authentication is managed
              through industry-standard OpenID Connect (OIDC). We use
              encryption at rest for stored data. However, no method of
              electronic transmission or storage is 100% secure.
            </p>

            <h2>6. Data Retention</h2>
            <p>
              We retain your account data and associated logs for as long as
              your account is active. If you delete your account, we will
              delete your personal data within 30 days, except where retention
              is required by law.
            </p>

            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access, correct, or delete your personal data</li>
              <li>Export your data (via PDF, Excel, or CSV export features)</li>
              <li>Revoke location permissions at any time</li>
              <li>Delete your account and all associated data</li>
            </ul>

            <h2>8. Cookies</h2>
            <p>
              We use essential cookies and local storage for authentication
              session management. We do not use third-party tracking cookies
              or advertising trackers.
            </p>

            <h2>9. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under 13. We do not
              knowingly collect personal information from children under 13.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the updated policy
              on this page with a revised "Last updated" date.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, contact us at:
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
