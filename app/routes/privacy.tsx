import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - LatentSEO" },
    { name: "description", content: "Privacy Policy for LatentSEO Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Last updated: January 2026</p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Introduction</h2>
        <p>
          LatentSEO ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Shopify application.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Information We Collect</h2>
        <p>When you install and use LatentSEO, we collect the following information:</p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li><strong>Shop Information:</strong> Your Shopify store domain, shop name, and email address for account identification and communication.</li>
          <li><strong>Product Data:</strong> Product titles, descriptions, images, and SEO metadata to provide our optimization services.</li>
          <li><strong>Usage Data:</strong> Information about how you use our app, including optimization history and settings preferences.</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Provide, maintain, and improve our SEO optimization services</li>
          <li>Generate AI-powered meta titles, descriptions, and alt text for your products</li>
          <li>Track optimization history and allow you to revert changes</li>
          <li>Send you service-related communications and updates</li>
          <li>Respond to your inquiries and provide customer support</li>
          <li>Monitor and analyze usage patterns to improve our app</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Third-Party Services</h2>
        <p>We use the following third-party services to provide our functionality:</p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li><strong>Google Gemini AI:</strong> To generate SEO-optimized content. Product data is sent to Google's API for processing. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3" }}>Google's Privacy Policy</a>.</li>
          <li><strong>Shopify:</strong> To access and update your store data. See <a href="https://www.shopify.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3" }}>Shopify's Privacy Policy</a>.</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Data Retention</h2>
        <p>
          We retain your data for as long as your account is active or as needed to provide you services. Optimization history is kept to enable the undo functionality. When you uninstall the app, we will delete your data within 48 hours upon receiving Shopify's shop redact webhook.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Data Security</h2>
        <p>
          We implement appropriate technical and organizational measures to protect your data, including:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Encryption of data in transit using TLS/SSL</li>
          <li>Secure storage of access tokens and credentials</li>
          <li>Regular security audits and updates</li>
          <li>Limited access to personal data on a need-to-know basis</li>
        </ul>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Your Rights (GDPR)</h2>
        <p>If you are located in the European Economic Area, you have the following rights:</p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li><strong>Access:</strong> Request a copy of your personal data</li>
          <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
          <li><strong>Erasure:</strong> Request deletion of your data</li>
          <li><strong>Portability:</strong> Request transfer of your data</li>
          <li><strong>Objection:</strong> Object to processing of your data</li>
        </ul>
        <p style={{ marginTop: "0.5rem" }}>
          To exercise these rights, please contact us at the email address below.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Customer Data</h2>
        <p>
          LatentSEO does not collect, store, or process end-customer personal data. We only access product catalog data (titles, descriptions, images) to provide SEO optimization services. No customer names, emails, addresses, or order information is accessed or stored by our application.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy or our data practices, please contact us at:
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
