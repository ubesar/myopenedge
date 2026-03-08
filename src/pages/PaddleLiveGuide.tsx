import { Button } from "@/components/ui/button";
import { ChevronLeft, Download, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const PaddleLiveGuide = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-content { 
            background: white !important; 
            color: black !important;
            padding: 20px !important;
          }
          .print-content * { color: black !important; }
          .print-content h1, .print-content h2, .print-content h3 { 
            color: #1a1a1a !important; 
            page-break-after: avoid;
          }
          .print-content table { 
            border-collapse: collapse; 
            width: 100%; 
            page-break-inside: avoid;
          }
          .print-content th, .print-content td { 
            border: 1px solid #ccc; 
            padding: 8px; 
            text-align: left;
          }
          .print-content th { background: #f0f0f0 !important; }
          .print-content code {
            background: #f5f5f5 !important;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
          }
          .print-content pre {
            background: #f5f5f5 !important;
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            page-break-inside: avoid;
          }
          .print-content .step-box {
            border: 1px solid #ddd !important;
            background: #fafafa !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground">
        {/* Navigation - hidden on print */}
        <nav className="no-print w-full border-b border-border/40 backdrop-blur-sm sticky top-0 bg-background/80 z-50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-xl font-bold tracking-tight">MyOpenEdge</span>
            </button>
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
              </Button>
              <Button onClick={() => navigate("/docs")} variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Docs
              </Button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="print-content max-w-4xl mx-auto px-6 py-10">
          {/* Title */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold mb-2">Paddle: Sandbox → Live Migration Guide</h1>
            <p className="text-muted-foreground">Complete step-by-step tutorial for MyOpenEdge</p>
            <p className="text-sm text-muted-foreground mt-2">Last updated: March 2026</p>
          </div>

          {/* Table of Contents */}
          <div className="mb-10 p-6 rounded-lg border border-border bg-card">
            <h2 className="text-xl font-semibold mb-4">📋 Table of Contents</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Current Sandbox Configuration</li>
              <li>Paddle Dashboard Setup (Live)</li>
              <li>Code Changes Required</li>
              <li>Domain Whitelisting</li>
              <li>Testing & Go-Live Checklist</li>
              <li>Troubleshooting Common Issues</li>
            </ol>
          </div>

          {/* Part 1: Current Config */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-primary">1. Current Sandbox Configuration</h2>
            <p className="mb-4 text-muted-foreground">
              Berikut adalah konfigurasi sandbox yang saat ini ada di codebase dan perlu diganti saat go-live:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border rounded-lg">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-4 py-2 text-left">Item</th>
                    <th className="border border-border px-4 py-2 text-left">Sandbox Value</th>
                    <th className="border border-border px-4 py-2 text-left">File Location</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2">Environment</td>
                    <td className="border border-border px-4 py-2"><code className="bg-muted px-2 py-1 rounded text-sm">"sandbox"</code></td>
                    <td className="border border-border px-4 py-2 text-sm">src/pages/Upgrade.tsx</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Client Token</td>
                    <td className="border border-border px-4 py-2"><code className="bg-muted px-2 py-1 rounded text-sm">test_906ae7bf...</code></td>
                    <td className="border border-border px-4 py-2 text-sm">src/pages/Upgrade.tsx</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Price ID</td>
                    <td className="border border-border px-4 py-2"><code className="bg-muted px-2 py-1 rounded text-sm">pri_01kk6rka...</code></td>
                    <td className="border border-border px-4 py-2 text-sm">src/pages/Upgrade.tsx</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Webhook Secret</td>
                    <td className="border border-border px-4 py-2"><code className="bg-muted px-2 py-1 rounded text-sm">PADDLE_WEBHOOK_SECRET</code></td>
                    <td className="border border-border px-4 py-2 text-sm">Supabase Secrets</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Part 2: Paddle Dashboard Setup */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-primary">2. Paddle Dashboard Setup (Live)</h2>
            
            <div className="space-y-6">
              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 2.1: Switch to Live Mode</h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Login ke <strong>vendors.paddle.com</strong></li>
                  <li>Klik dropdown di pojok kiri atas (biasanya tertulis "Sandbox")</li>
                  <li>Pilih <strong>"Live"</strong> untuk switch ke production mode</li>
                </ol>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 2.2: Complete Business Verification</h3>
                <p className="text-muted-foreground mb-2">Sebelum bisa menerima pembayaran live, kamu harus:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>KYC (Know Your Customer)</strong> - Upload ID/passport</li>
                  <li><strong>Tax Information</strong> - Isi form W-8BEN (non-US) atau W-9 (US)</li>
                  <li><strong>Business Details</strong> - Alamat, website, deskripsi bisnis</li>
                  <li><strong>Payout Settings</strong> - Bank account untuk menerima pembayaran</li>
                </ol>
                <p className="text-sm text-yellow-500 mt-2">⚠️ Proses approval bisa 1-5 hari kerja</p>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 2.3: Create Live Product</h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Navigate to <strong>Catalog → Products</strong></li>
                  <li>Click <strong>"+ New Product"</strong></li>
                  <li>Fill in:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li>Name: <code className="bg-muted px-2 py-0.5 rounded text-sm">MyOpenEdge Pro</code></li>
                      <li>Description: <code className="bg-muted px-2 py-0.5 rounded text-sm">Full access to all IB, Momentum & OCC analysis tools</code></li>
                    </ul>
                  </li>
                  <li>Save product</li>
                </ol>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 2.4: Create Live Price</h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Inside the product, click <strong>"+ Add Price"</strong></li>
                  <li>Configure:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li>Billing Type: <strong>Recurring</strong></li>
                      <li>Amount: <strong>$3.00 USD</strong></li>
                      <li>Billing Period: <strong>Monthly</strong></li>
                    </ul>
                  </li>
                  <li>Save price</li>
                  <li><strong>Copy the Price ID</strong> (format: <code className="bg-muted px-2 py-0.5 rounded text-sm">pri_01abc123...</code>)</li>
                </ol>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 2.5: Get Client-Side Token</h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Go to <strong>Developer Tools → Authentication</strong></li>
                  <li>Under "Client-side tokens", find your <strong>Live client token</strong></li>
                  <li>Format: <code className="bg-muted px-2 py-0.5 rounded text-sm">live_abc123...</code> (NOT starting with "test_")</li>
                  <li><strong>Copy this token</strong></li>
                </ol>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 2.6: Setup Webhook Notification</h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Go to <strong>Developer Tools → Notifications</strong></li>
                  <li>Click <strong>"+ New Destination"</strong></li>
                  <li>Configure:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li>Type: <strong>Webhook</strong></li>
                      <li>URL: <code className="bg-muted px-2 py-0.5 rounded text-sm break-all">https://pyffawxowidfqyhxjlvb.supabase.co/functions/v1/paddle-webhook</code></li>
                      <li>Events to subscribe:
                        <ul className="list-disc list-inside ml-6">
                          <li>subscription.created</li>
                          <li>subscription.updated</li>
                          <li>subscription.canceled</li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                  <li>Save notification</li>
                  <li><strong>Copy the Webhook Secret</strong> (click to reveal)</li>
                </ol>
                <p className="text-sm text-green-500 mt-2">✅ Webhook URL sama dengan sandbox, tapi notification destination berbeda</p>
              </div>
            </div>
          </section>

          {/* Part 3: Code Changes */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-primary">3. Code Changes Required</h2>
            
            <div className="space-y-6">
              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">File 1: src/pages/Upgrade.tsx</h3>
                <p className="text-muted-foreground mb-3">Update 3 nilai di fungsi initializePaddle:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// BEFORE (Sandbox)
initializePaddle({
  environment: "sandbox",
  token: "test_906ae7bf74bbcaf25341c87dd7f",
  ...
});
// Price ID: "pri_01kk6rkazpp86ckkdf76wtbg9s"

// AFTER (Live)
initializePaddle({
  environment: "production",
  token: "live_YOUR_LIVE_TOKEN_HERE",
  ...
});
// Price ID: "pri_YOUR_LIVE_PRICE_ID"`}
                </pre>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">File 2: Supabase Edge Function Secret</h3>
                <p className="text-muted-foreground mb-3">Update PADDLE_WEBHOOK_SECRET dengan live webhook secret:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Buka Lovable project settings</li>
                  <li>Navigate ke <strong>Cloud → Secrets</strong></li>
                  <li>Edit <code className="bg-muted px-2 py-0.5 rounded text-sm">PADDLE_WEBHOOK_SECRET</code></li>
                  <li>Replace dengan Live webhook secret dari Paddle</li>
                  <li>Save</li>
                </ol>
                <p className="text-sm text-yellow-500 mt-2">⚠️ Edge function akan auto-redeploy setelah secret diupdate</p>
              </div>
            </div>
          </section>

          {/* Part 4: Domain Whitelisting */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-primary">4. Domain Whitelisting</h2>
            
            <div className="space-y-6">
              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 4.1: Add Approved Domains</h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Go to <strong>Checkout → Checkout Settings</strong></li>
                  <li>Under "Approved domains", add:
                    <ul className="list-disc list-inside ml-6 mt-1">
                      <li><code className="bg-muted px-2 py-0.5 rounded text-sm">myopenedge.xyz</code> (production)</li>
                      <li><code className="bg-muted px-2 py-0.5 rounded text-sm">myopenedge.lovable.app</code> (staging)</li>
                      <li><code className="bg-muted px-2 py-0.5 rounded text-sm">lovableproject.com</code> (preview)</li>
                    </ul>
                  </li>
                  <li>Save changes</li>
                </ol>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">Step 4.2: Set Default Payment Link</h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
                  <li>In <strong>Checkout Settings</strong>, find "Default payment link"</li>
                  <li>Set to: <code className="bg-muted px-2 py-0.5 rounded text-sm">https://myopenedge.xyz</code></li>
                  <li>This prevents "Origin not allowed" errors</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Part 5: Testing Checklist */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-primary">5. Testing & Go-Live Checklist</h2>
            
            <div className="step-box p-4 rounded-lg border border-border bg-card">
              <h3 className="font-semibold mb-4">Pre-Launch Checklist</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Business verification approved by Paddle</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Live Product & Price created</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Code updated with live credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">PADDLE_WEBHOOK_SECRET updated to live value</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Domains whitelisted in Paddle</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Test purchase with real card ($3)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Verify webhook received (check edge function logs)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Verify profile.subscription_status = 'active' in database</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">☐</span>
                  <span className="text-muted-foreground">Test cancel subscription flow</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Part 6: Troubleshooting */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-primary">6. Troubleshooting Common Issues</h2>
            
            <div className="space-y-4">
              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">❌ "Origin not allowed" Error</h3>
                <p className="text-muted-foreground">
                  <strong>Cause:</strong> Domain not whitelisted in Paddle<br/>
                  <strong>Fix:</strong> Add domain to Checkout Settings → Approved domains
                </p>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">❌ Webhook 401 Unauthorized</h3>
                <p className="text-muted-foreground">
                  <strong>Cause:</strong> PADDLE_WEBHOOK_SECRET tidak match<br/>
                  <strong>Fix:</strong> Copy ulang webhook secret dari Live notification destination
                </p>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">❌ Subscription not updating in database</h3>
                <p className="text-muted-foreground">
                  <strong>Cause:</strong> user_id tidak ada di custom_data<br/>
                  <strong>Fix:</strong> Pastikan checkout mengirim customData dengan user.id
                </p>
              </div>

              <div className="step-box p-4 rounded-lg border border-border bg-card">
                <h3 className="font-semibold mb-2">❌ Checkout not opening</h3>
                <p className="text-muted-foreground">
                  <strong>Cause:</strong> Using Product ID instead of Price ID<br/>
                  <strong>Fix:</strong> Pastikan menggunakan Price ID (pri_xxx), bukan Product ID (pro_xxx)
                </p>
              </div>
            </div>
          </section>

          {/* Summary Box */}
          <section className="mb-10 p-6 rounded-lg border-2 border-primary/30 bg-primary/5">
            <h2 className="text-xl font-bold mb-4">📌 Quick Reference</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Files to Edit:</h4>
                <ul className="text-sm space-y-1">
                  <li>• src/pages/Upgrade.tsx</li>
                  <li>• Supabase Secrets (PADDLE_WEBHOOK_SECRET)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Values to Replace:</h4>
                <ul className="text-sm space-y-1">
                  <li>• environment: "sandbox" → "production"</li>
                  <li>• token: test_xxx → live_xxx</li>
                  <li>• priceId: sandbox ID → live ID</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="text-center text-sm text-muted-foreground pt-6 border-t border-border">
            <p>MyOpenEdge © 2026 — Paddle Integration Guide</p>
            <p className="mt-1">For support, contact support@myopenedge.xyz</p>
          </footer>
        </main>
      </div>
    </>
  );
};

export default PaddleLiveGuide;
