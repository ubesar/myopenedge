import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/logo.png";

export default function TermsConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur px-4 sm:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Legal</h1>
            <p className="text-xs text-muted-foreground">Last updated: March 8, 2026</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <Tabs defaultValue="terms" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-8">
            <TabsTrigger value="terms" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-4 w-4" /> T&Cs
            </TabsTrigger>
            <TabsTrigger value="refund" className="gap-1.5 text-xs sm:text-sm">
              <RotateCcw className="h-4 w-4" /> Refund
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="h-4 w-4" /> Privacy
            </TabsTrigger>
          </TabsList>

          {/* ====== TERMS & CONDITIONS ====== */}
          <TabsContent value="terms" className="space-y-8 text-foreground">
            <section className="space-y-3">
              <h2 className="text-xl font-bold">1. Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using MyOpenEdge ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not access or use the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                MyOpenEdge is a web-based trading analytics platform that provides market structure analysis tools, including Initial Balance (IB), Momentum, Outside Candle Close (OCC), and Gap Fill analysis. The Service is intended for informational and educational purposes only and does not constitute financial advice.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">3. User Accounts</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>You must provide accurate and complete information when creating an account.</li>
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>You must be at least 18 years old to use the Service.</li>
                <li>One person or entity may not maintain more than one account.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">4. Subscription & Payments</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>The Service offers both free and paid subscription tiers.</li>
                <li>Paid subscriptions are billed via Paddle, our merchant of record.</li>
                <li>Subscription access begins upon confirmed payment and lasts for the specified period.</li>
                <li>Prices are subject to change with reasonable notice to existing subscribers.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">5. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Use the Service for any illegal or unauthorized purpose.</li>
                <li>Attempt to reverse-engineer, decompile, or disassemble the Service.</li>
                <li>Interfere with or disrupt the integrity or performance of the Service.</li>
                <li>Share, resell, or redistribute your account access or subscription.</li>
                <li>Scrape, crawl, or use automated tools to extract data from the Service.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">6. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of the Service — including but not limited to analysis algorithms, user interface design, text, graphics, and logos — are owned by MyOpenEdge and are protected by intellectual property laws. You may not copy, modify, or create derivative works without prior written consent.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">7. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. MyOpenEdge does not guarantee the accuracy, completeness, or reliability of any analysis or data provided through the Service.
              </p>
              <p className="text-muted-foreground leading-relaxed font-semibold">
                Trading and investing involve substantial risk of loss. The analysis provided by MyOpenEdge is not financial advice and should not be treated as such. You are solely responsible for your own trading decisions.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                In no event shall MyOpenEdge, its owners, employees, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to financial losses from trading decisions.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">9. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">10. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may revise these Terms at any time by updating this page. Continued use of the Service after changes constitutes acceptance of the updated terms. Material changes will be communicated via email or in-app notification.
              </p>
            </section>
          </TabsContent>

          {/* ====== REFUND POLICY ====== */}
          <TabsContent value="refund" className="space-y-8 text-foreground">
            <section className="space-y-3">
              <h2 className="text-xl font-bold">1. Digital Product</h2>
              <p className="text-muted-foreground leading-relaxed">
                MyOpenEdge is a digital subscription service. Because digital products are delivered instantly upon payment confirmation, all sales are considered final once access has been granted.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">2. Eligibility for Refund</h2>
              <p className="text-muted-foreground leading-relaxed">Refunds may be considered under the following circumstances:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Duplicate or accidental payment (verified on-chain).</li>
                <li>Service was completely unavailable for a significant portion of the subscription period due to our fault.</li>
                <li>Payment was confirmed but access was never granted due to a technical error on our end.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">3. Non-Refundable Cases</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Change of mind after purchase.</li>
                <li>Failure to use the Service during the subscription period.</li>
                <li>Dissatisfaction with analysis results or trading outcomes.</li>
                <li>Inability to access due to user-side technical issues (browser, network, etc.).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">4. Cryptocurrency Payments</h2>
              <p className="text-muted-foreground leading-relaxed">
                All payments are processed via Paddle, our merchant of record. Refunds (if approved) will be issued to the original payment method. Processing times may vary depending on your payment provider.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">5. How to Request a Refund</h2>
              <p className="text-muted-foreground leading-relaxed">
                To request a refund, contact us at <span className="text-primary font-medium">support@myopenedge.com</span> within 7 days of payment with your order ID and account email. Refund requests are reviewed within 5 business days.
              </p>
            </section>
          </TabsContent>

          {/* ====== PRIVACY POLICY ====== */}
          <TabsContent value="privacy" className="space-y-8 text-foreground">
            <section className="space-y-3">
              <h2 className="text-xl font-bold">1. Information We Collect</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li><strong>Account Information:</strong> Email address and display name provided during registration.</li>
                <li><strong>Usage Data:</strong> Analysis parameters, saved templates, and trading journal entries you create within the Service.</li>
                <li><strong>Payment Data:</strong> Order IDs and transaction records processed through Paddle. We do not store your full payment details — Paddle handles all payment data securely as our merchant of record.</li>
                <li><strong>Technical Data:</strong> Browser type, device information, and IP address for security and analytics purposes.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>To provide and maintain the Service and your account.</li>
                <li>To process subscription payments and manage access.</li>
                <li>To communicate important updates about the Service.</li>
                <li>To detect and prevent fraud or unauthorized access.</li>
                <li>To improve the Service based on aggregated, anonymized usage patterns.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">3. Data Storage & Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your data is stored securely using industry-standard encryption and access controls. We use row-level security policies to ensure users can only access their own data. All data transmission is encrypted via HTTPS/TLS.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">4. Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed">We use the following third-party services:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li><strong>NOWPayments:</strong> For cryptocurrency payment processing.</li>
                <li><strong>TwelveData:</strong> For market data used in analysis (data is fetched server-side).</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                These services have their own privacy policies. We do not sell, rent, or share your personal data with third parties for marketing purposes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">5. Your Rights</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li><strong>Access:</strong> You can view all your data within the Service at any time.</li>
                <li><strong>Correction:</strong> You can update your profile information through account settings.</li>
                <li><strong>Deletion:</strong> You may request complete deletion of your account and associated data by contacting support.</li>
                <li><strong>Export:</strong> You may request an export of your data in a standard format.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">6. Cookies & Local Storage</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use browser local storage to maintain your authentication session and user preferences. We do not use third-party tracking cookies for advertising.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">7. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of the Service constitutes acceptance of the revised policy.
              </p>
            </section>
          </TabsContent>
        </Tabs>

        {/* Shared footer */}
        <div className="mt-10 pt-8 border-t border-border/40 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            For questions, contact us at <span className="text-primary font-medium">support@myopenedge.com</span>
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MyOpenEdge. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}
