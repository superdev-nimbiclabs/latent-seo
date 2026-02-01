import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service - LatentSEO" },
    { name: "description", content: "Terms of Service for LatentSEO Shopify App" },
  ];
};

export default function TermsOfService() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Terms of Service</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Last updated: January 2026</p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>1. Acceptance of Terms</h2>
        <p>
          By installing and using LatentSEO ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>2. Description of Service</h2>
        <p>
          LatentSEO is a Shopify application that provides AI-powered SEO optimization services, including:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Automated meta title and description generation</li>
          <li>Image alt text generation using AI vision</li>
          <li>SEO audit and health scoring</li>
          <li>Optimization history and undo functionality</li>
          <li>JSON-LD schema markup injection</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>3. Account and Access</h2>
        <p>
          To use the App, you must have a valid Shopify store and install the App through the Shopify App Store. You are responsible for maintaining the security of your Shopify account and any activities that occur under your account.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>4. Subscription and Billing</h2>
        <p>
          LatentSEO offers different subscription tiers with varying features and limits. By subscribing to a paid plan, you agree to pay the applicable fees. Billing is handled through Shopify's billing system. You may cancel your subscription at any time through the Shopify admin.
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li><strong>Free Plan:</strong> Limited features with monthly optimization limits</li>
          <li><strong>Starter Plan:</strong> $9.99/month - Increased limits and features</li>
          <li><strong>Professional Plan:</strong> $29.99/month - Higher limits, priority processing</li>
          <li><strong>Enterprise Plan:</strong> $79.99/month - Unlimited optimizations, premium support</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>5. AI-Generated Content</h2>
        <p>
          The App uses artificial intelligence to generate SEO content. While we strive for high-quality output:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>AI-generated content should be reviewed before publishing</li>
          <li>We do not guarantee specific SEO results or rankings</li>
          <li>You retain full ownership of your product data and generated content</li>
          <li>You are responsible for ensuring generated content complies with applicable laws</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>6. Undo and Data Recovery</h2>
        <p>
          The App maintains a history of optimizations and allows you to revert changes. However:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Undo functionality depends on stored optimization logs</li>
          <li>We recommend reviewing changes before bulk operations</li>
          <li>Data recovery is not guaranteed for manually deleted records</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>7. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Use the App for any unlawful purpose</li>
          <li>Attempt to circumvent usage limits or billing</li>
          <li>Interfere with the App's operation or security</li>
          <li>Reverse engineer or copy the App's functionality</li>
          <li>Use the App to generate misleading or deceptive content</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, LatentSEO and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities, arising from your use of the App.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>9. Disclaimer of Warranties</h2>
        <p>
          The App is provided "as is" without warranties of any kind, either express or implied. We do not warrant that the App will be uninterrupted, error-free, or that defects will be corrected.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>10. Modifications</h2>
        <p>
          We reserve the right to modify these Terms at any time. We will notify users of significant changes through the App or via email. Continued use of the App after changes constitutes acceptance of the new Terms.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>11. Termination</h2>
        <p>
          We may terminate or suspend your access to the App at any time for violation of these Terms or for any other reason at our discretion. Upon termination, your right to use the App will immediately cease.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>12. Contact</h2>
        <p>
          For questions about these Terms, please contact us at:
        </p>
        <p style={{ marginTop: "0.5rem" }}>
          <strong>Email:</strong> <a href="mailto:support@nimbiclabs.com" style={{ color: "#0070f3" }}>support@nimbiclabs.com</a>
        </p>
      </section>

      <footer style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid #eee", color: "#666", fontSize: "0.9rem" }}>
        <p>© 2026 NimbiClabs. All rights reserved.</p>
      </footer>
    </div>
  );
}
