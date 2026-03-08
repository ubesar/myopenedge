import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            <h1 className="text-lg font-bold text-foreground">Terms & Conditions</h1>
            <p className="text-xs text-muted-foreground">Last updated: March 8, 2026</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8 text-foreground">
        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            1. Agreement to Terms
          </h2>
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
            <li>Paid subscriptions are billed in cryptocurrency via NOWPayments.</li>
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

        <section className="space-y-3">
          <h2 className="text-xl font-bold">11. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For questions about these Terms, please contact us at <span className="text-primary font-medium">support@myopenedge.com</span>.
          </p>
        </section>

        <div className="pt-8 border-t border-border/40 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} MyOpenEdge. All rights reserved.
        </div>
      </main>
    </div>
  );
}
