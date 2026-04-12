import Navbar from "./Navbar.tsx";
import Footer from "./Footer.tsx";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-6 prose prose-invert prose-sm">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: March 30, 2026
          </p>

          <section className="space-y-4 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the GroundWork application ("Service"),
              you agree to be bound by these Terms of Service ("Terms"). If
              you do not agree, do not use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              GroundWork is a cloud-based log management platform that enables
              users to create, organize, and export site inspection logs with
              photo attachments, GPS data, and team collaboration features.
              The Service is available as a web application and a mobile app.
            </p>

            <h2>3. Accounts</h2>
            <p>
              To use the Service, you must create an account. You are
              responsible for maintaining the security of your account
              credentials and for all activity that occurs under your account.
              You must provide accurate and complete information when creating
              your account.
            </p>

            <h2>4. Subscription Plans</h2>
            <p>
              GroundWork offers multiple subscription tiers (Free, Pro, and
              Business). Each tier provides different features and usage
              limits as described on our pricing page. We reserve the right
              to modify pricing and plan features with 30 days' notice to
              active subscribers.
            </p>

            <h2>5. Payment</h2>
            <p>
              Paid subscriptions are billed on a recurring monthly basis.
              Payment is processed through our third-party payment processor
              (Stripe). By subscribing, you authorize us to charge
              your selected payment method for the applicable subscription
              fee. Subscriptions automatically renew unless cancelled before
              the next billing cycle.
            </p>

            <h2>6. User Content</h2>
            <p>
              You retain ownership of all content you create through the
              Service, including log entries, photos, and site data ("User
              Content"). By using the Service, you grant us a limited license
              to store, process, and display your User Content solely for
              the purpose of providing the Service to you.
            </p>
            <p>
              You are solely responsible for the User Content you upload. You
              must not upload content that is illegal, harmful, or infringes
              on third-party rights.
            </p>

            <h2>7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>
                Attempt to gain unauthorized access to any part of the Service
              </li>
              <li>Interfere with the proper operation of the Service</li>
              <li>
                Use automated means to access the Service without our written
                consent
              </li>
              <li>Resell or redistribute the Service</li>
            </ul>

            <h2>8. Team Features</h2>
            <p>
              If you create or join a team, you agree that team
              administrators may manage team settings, member access, and
              shared content. Team data (sites and logs) is accessible to
              all team members. Individual users may leave a team at any time.
            </p>

            <h2>9. Data Export</h2>
            <p>
              You may export your data at any time using the built-in export
              features (PDF, Excel, CSV). We support your right to data
              portability.
            </p>

            <h2>10. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee
              uninterrupted access to the Service. We may perform maintenance
              or updates that temporarily affect availability. The Service
              includes offline capabilities that allow limited functionality
              without an internet connection.
            </p>

            <h2>11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, GroundWork and its
              operators shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages arising out of
              your use of or inability to use the Service. Our total
              liability shall not exceed the amount you paid us in the
              twelve months preceding the claim.
            </p>

            <h2>12. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" and "as available" without
              warranties of any kind, whether express or implied. We do not
              warrant that the Service will be error-free, secure, or
              available at all times.
            </p>

            <h2>13. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any
              time for violation of these Terms or for any other reason with
              reasonable notice. You may delete your account at any time.
              Upon termination, your right to use the Service ceases
              immediately.
            </p>

            <h2>14. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify
              you of material changes by posting the updated Terms on this
              page. Your continued use of the Service after changes are
              posted constitutes acceptance of the revised Terms.
            </p>

            <h2>15. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with
              the laws of the United States. Any disputes arising from
              these Terms or the Service shall be resolved in the courts
              of competent jurisdiction.
            </p>

            <h2>16. Contact</h2>
            <p>
              For questions about these Terms, contact us at:
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
