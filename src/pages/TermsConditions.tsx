import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck, RotateCcw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/logo.png";

type Lang = "en" | "id";

const content = {
  en: {
    legal: "Legal",
    lastUpdated: "Last updated: March 14, 2026",
    tabs: { terms: "T&Cs", refund: "Refund", privacy: "Privacy" },
    contact: "For questions, contact us at",
    rights: "All rights reserved.",
    terms: [
      { title: "1. Agreement to Terms", body: "By accessing or using MyOpenEdge (\"the Service\"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not access or use the Service." },
      { title: "2. Description of Service", body: "MyOpenEdge is a web-based trading analytics platform that provides market structure analysis tools, including Initial Balance (IB), Momentum, Opening Candle Continuation(OCC), and Gap Fill analysis. The Service is intended for informational and educational purposes only and does not constitute financial advice." },
      { title: "3. User Accounts", list: [
        "You must provide accurate and complete information when creating an account.",
        "You are responsible for maintaining the security of your account credentials.",
        "You must be at least 18 years old to use the Service.",
        "One person or entity may not maintain more than one account.",
      ]},
      { title: "4. Subscription & Payments", list: [
        "The Service offers both free and paid subscription tiers.",
        "Paid subscriptions are billed via Midtrans, our payment gateway.",
        "Subscription access begins upon confirmed payment and lasts for the specified period.",
        "Prices are subject to change with reasonable notice to existing subscribers.",
      ]},
      { title: "5. Acceptable Use", intro: "You agree not to:", list: [
        "Use the Service for any illegal or unauthorized purpose.",
        "Attempt to reverse-engineer, decompile, or disassemble the Service.",
        "Interfere with or disrupt the integrity or performance of the Service.",
        "Share, resell, or redistribute your account access or subscription.",
        "Scrape, crawl, or use automated tools to extract data from the Service.",
      ]},
      { title: "6. Intellectual Property", body: "All content, features, and functionality of the Service — including but not limited to analysis algorithms, user interface design, text, graphics, and logos — are owned by MyOpenEdge and are protected by intellectual property laws. You may not copy, modify, or create derivative works without prior written consent." },
      { title: "7. Disclaimer of Warranties", body: "The Service is provided \"as is\" and \"as available\" without warranties of any kind, either express or implied. MyOpenEdge does not guarantee the accuracy, completeness, or reliability of any analysis or data provided through the Service.", bold: "Trading and investing involve substantial risk of loss. The analysis provided by MyOpenEdge is not financial advice and should not be treated as such. You are solely responsible for your own trading decisions." },
      { title: "8. Limitation of Liability", body: "In no event shall MyOpenEdge, its owners, employees, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to financial losses from trading decisions." },
      { title: "9. Termination", body: "We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties." },
      { title: "10. Changes to Terms", body: "We may revise these Terms at any time by updating this page. Continued use of the Service after changes constitutes acceptance of the updated terms. Material changes will be communicated via email or in-app notification." },
    ],
    refund: [
      { title: "1. Digital Product", body: "MyOpenEdge is a digital subscription service. Because digital products are delivered instantly upon payment confirmation, all sales are considered final once access has been granted." },
      { title: "2. Eligibility for Refund", intro: "Refunds may be considered under the following circumstances:", list: [
        "Duplicate or accidental payment.",
        "Service was completely unavailable for a significant portion of the subscription period due to our fault.",
        "Payment was confirmed but access was never granted due to a technical error on our end.",
      ]},
      { title: "3. Non-Refundable Cases", list: [
        "Change of mind after purchase.",
        "Failure to use the Service during the subscription period.",
        "Dissatisfaction with analysis results or trading outcomes.",
        "Inability to access due to user-side technical issues (browser, network, etc.).",
      ]},
      { title: "4. Payment Processing", body: "All payments are processed via Midtrans, our payment gateway. Refunds (if approved) will be issued to the original payment method. Processing times may vary depending on your payment provider." },
      { title: "5. How to Request a Refund", body: "To request a refund, contact us at ", link: "https://x.com/Ubetrades", linkLabel: "https://x.com/Ubetrades", after: " within 7 days of payment with your order ID and account email. Refund requests are reviewed within 5 business days." },
    ],
    privacy: [
      { title: "1. Information We Collect", list: [
        { label: "Account Information:", text: "Email address and display name provided during registration." },
        { label: "Usage Data:", text: "Analysis parameters, saved templates, and trading journal entries you create within the Service." },
        { label: "Payment Data:", text: "Order IDs and transaction records processed through Midtrans. We do not store your full payment details — Midtrans handles all payment data securely as our payment gateway." },
        { label: "Technical Data:", text: "Browser type, device information, and IP address for security and analytics purposes." },
      ]},
      { title: "2. How We Use Your Information", list: [
        "To provide and maintain the Service and your account.",
        "To process subscription payments and manage access.",
        "To communicate important updates about the Service.",
        "To detect and prevent fraud or unauthorized access.",
        "To improve the Service based on aggregated, anonymized usage patterns.",
      ]},
      { title: "3. Data Storage & Security", body: "Your data is stored securely using industry-standard encryption and access controls. We use row-level security policies to ensure users can only access their own data. All data transmission is encrypted via HTTPS/TLS." },
      { title: "4. Third-Party Services", intro: "We use the following third-party services:", list: [
        { label: "Midtrans:", text: "Payment gateway for processing subscription payments securely." },
        { label: "TwelveData:", text: "For market data used in analysis (data is fetched server-side)." },
      ], after: "These services have their own privacy policies. We do not sell, rent, or share your personal data with third parties for marketing purposes." },
      { title: "5. Your Rights", list: [
        { label: "Access:", text: "You can view all your data within the Service at any time." },
        { label: "Correction:", text: "You can update your profile information through account settings." },
        { label: "Deletion:", text: "You may request complete deletion of your account and associated data by contacting support." },
        { label: "Export:", text: "You may request an export of your data in a standard format." },
      ]},
      { title: "6. Cookies & Local Storage", body: "We use browser local storage to maintain your authentication session and user preferences. We do not use third-party tracking cookies for advertising." },
      { title: "7. Changes to This Policy", body: "We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of the Service constitutes acceptance of the revised policy." },
    ],
  },
  id: {
    legal: "Hukum",
    lastUpdated: "Terakhir diperbarui: 14 Maret 2026",
    tabs: { terms: "S&K", refund: "Refund", privacy: "Privasi" },
    contact: "Untuk pertanyaan, hubungi kami di",
    rights: "Hak cipta dilindungi.",
    terms: [
      { title: "1. Persetujuan Terhadap Ketentuan", body: "Dengan mengakses atau menggunakan MyOpenEdge (\"Layanan\"), Anda setuju untuk terikat oleh Syarat dan Ketentuan ini. Jika Anda tidak menyetujui ketentuan ini, Anda tidak diperkenankan mengakses atau menggunakan Layanan." },
      { title: "2. Deskripsi Layanan", body: "MyOpenEdge adalah platform analisis trading berbasis web yang menyediakan alat analisis struktur pasar, termasuk Initial Balance (IB), Momentum, Opening Candle Continuation(OCC), dan Gap Fill analysis. Layanan ini hanya ditujukan untuk tujuan informasi dan edukasi, serta tidak merupakan nasihat keuangan." },
      { title: "3. Akun Pengguna", list: [
        "Anda harus memberikan informasi yang akurat dan lengkap saat membuat akun.",
        "Anda bertanggung jawab menjaga keamanan kredensial akun Anda.",
        "Anda harus berusia minimal 18 tahun untuk menggunakan Layanan.",
        "Satu orang atau entitas tidak boleh memiliki lebih dari satu akun.",
      ]},
      { title: "4. Langganan & Pembayaran", list: [
        "Layanan menawarkan paket gratis dan berbayar.",
        "Langganan berbayar diproses melalui Midtrans, payment gateway kami.",
        "Akses langganan dimulai setelah pembayaran dikonfirmasi dan berlaku selama periode yang ditentukan.",
        "Harga dapat berubah dengan pemberitahuan yang wajar kepada pelanggan yang sudah ada.",
      ]},
      { title: "5. Penggunaan yang Diperbolehkan", intro: "Anda setuju untuk tidak:", list: [
        "Menggunakan Layanan untuk tujuan ilegal atau tidak sah.",
        "Mencoba reverse-engineer, decompile, atau membongkar Layanan.",
        "Mengganggu integritas atau kinerja Layanan.",
        "Membagikan, menjual kembali, atau mendistribusikan ulang akses akun atau langganan Anda.",
        "Melakukan scraping, crawling, atau menggunakan alat otomatis untuk mengekstrak data dari Layanan.",
      ]},
      { title: "6. Kekayaan Intelektual", body: "Semua konten, fitur, dan fungsionalitas Layanan — termasuk namun tidak terbatas pada algoritma analisis, desain antarmuka pengguna, teks, grafik, dan logo — adalah milik MyOpenEdge dan dilindungi oleh hukum kekayaan intelektual. Anda tidak boleh menyalin, memodifikasi, atau membuat karya turunan tanpa persetujuan tertulis sebelumnya." },
      { title: "7. Penolakan Jaminan", body: "Layanan disediakan \"sebagaimana adanya\" dan \"sebagaimana tersedia\" tanpa jaminan apa pun, baik tersurat maupun tersirat. MyOpenEdge tidak menjamin keakuratan, kelengkapan, atau keandalan analisis atau data apa pun yang disediakan melalui Layanan.", bold: "Trading dan investasi melibatkan risiko kerugian yang besar. Analisis yang disediakan oleh MyOpenEdge bukan merupakan nasihat keuangan dan tidak boleh diperlakukan demikian. Anda sepenuhnya bertanggung jawab atas keputusan trading Anda sendiri." },
      { title: "8. Batasan Tanggung Jawab", body: "Dalam keadaan apa pun, MyOpenEdge, pemilik, karyawan, atau afiliasinya tidak bertanggung jawab atas kerugian tidak langsung, insidental, khusus, konsekuensial, atau punitif yang timbul dari penggunaan Layanan oleh Anda, termasuk namun tidak terbatas pada kerugian finansial dari keputusan trading." },
      { title: "9. Pengakhiran", body: "Kami berhak menangguhkan atau mengakhiri akses Anda ke Layanan atas kebijakan kami sendiri, tanpa pemberitahuan, untuk perilaku yang kami yakini melanggar Ketentuan ini atau merugikan pengguna lain, kami, atau pihak ketiga." },
      { title: "10. Perubahan Ketentuan", body: "Kami dapat merevisi Ketentuan ini kapan saja dengan memperbarui halaman ini. Penggunaan Layanan yang berkelanjutan setelah perubahan merupakan penerimaan terhadap ketentuan yang diperbarui. Perubahan material akan dikomunikasikan melalui email atau notifikasi dalam aplikasi." },
    ],
    refund: [
      { title: "1. Produk Digital", body: "MyOpenEdge adalah layanan langganan digital. Karena produk digital dikirimkan secara instan setelah konfirmasi pembayaran, semua penjualan dianggap final setelah akses diberikan." },
      { title: "2. Kelayakan Refund", intro: "Refund dapat dipertimbangkan dalam keadaan berikut:", list: [
        "Pembayaran ganda atau tidak disengaja.",
        "Layanan sepenuhnya tidak tersedia selama sebagian besar periode langganan karena kesalahan kami.",
        "Pembayaran dikonfirmasi tetapi akses tidak pernah diberikan karena kesalahan teknis dari pihak kami.",
      ]},
      { title: "3. Kasus Non-Refundable", list: [
        "Berubah pikiran setelah pembelian.",
        "Tidak menggunakan Layanan selama periode langganan.",
        "Ketidakpuasan dengan hasil analisis atau hasil trading.",
        "Ketidakmampuan mengakses karena masalah teknis dari sisi pengguna (browser, jaringan, dll.).",
      ]},
      { title: "4. Pemrosesan Pembayaran", body: "Semua pembayaran diproses melalui Midtrans, payment gateway kami. Refund (jika disetujui) akan dikembalikan ke metode pembayaran asli. Waktu pemrosesan dapat bervariasi tergantung penyedia pembayaran Anda." },
      { title: "5. Cara Mengajukan Refund", body: "Untuk mengajukan refund, hubungi kami di ", link: "https://x.com/Ubetrades", linkLabel: "https://x.com/Ubetrades", after: " dalam 7 hari setelah pembayaran dengan order ID dan email akun Anda. Permintaan refund ditinjau dalam 5 hari kerja." },
    ],
    privacy: [
      { title: "1. Informasi yang Kami Kumpulkan", list: [
        { label: "Informasi Akun:", text: "Alamat email dan nama tampilan yang diberikan saat pendaftaran." },
        { label: "Data Penggunaan:", text: "Parameter analisis, template tersimpan, dan entri jurnal trading yang Anda buat dalam Layanan." },
        { label: "Data Pembayaran:", text: "Order ID dan catatan transaksi yang diproses melalui Midtrans. Kami tidak menyimpan detail pembayaran lengkap Anda — Midtrans menangani semua data pembayaran secara aman sebagai payment gateway kami." },
        { label: "Data Teknis:", text: "Jenis browser, informasi perangkat, dan alamat IP untuk keperluan keamanan dan analitik." },
      ]},
      { title: "2. Cara Kami Menggunakan Informasi Anda", list: [
        "Untuk menyediakan dan memelihara Layanan dan akun Anda.",
        "Untuk memproses pembayaran langganan dan mengelola akses.",
        "Untuk mengkomunikasikan pembaruan penting tentang Layanan.",
        "Untuk mendeteksi dan mencegah penipuan atau akses tidak sah.",
        "Untuk meningkatkan Layanan berdasarkan pola penggunaan agregat dan anonim.",
      ]},
      { title: "3. Penyimpanan & Keamanan Data", body: "Data Anda disimpan secara aman menggunakan enkripsi standar industri dan kontrol akses. Kami menggunakan kebijakan keamanan tingkat baris untuk memastikan pengguna hanya dapat mengakses data mereka sendiri. Semua transmisi data dienkripsi melalui HTTPS/TLS." },
      { title: "4. Layanan Pihak Ketiga", intro: "Kami menggunakan layanan pihak ketiga berikut:", list: [
        { label: "Midtrans:", text: "Payment gateway untuk memproses pembayaran langganan secara aman." },
        { label: "TwelveData:", text: "Untuk data pasar yang digunakan dalam analisis (data diambil dari sisi server)." },
      ], after: "Layanan-layanan ini memiliki kebijakan privasi masing-masing. Kami tidak menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan pemasaran." },
      { title: "5. Hak Anda", list: [
        { label: "Akses:", text: "Anda dapat melihat semua data Anda dalam Layanan kapan saja." },
        { label: "Koreksi:", text: "Anda dapat memperbarui informasi profil melalui pengaturan akun." },
        { label: "Penghapusan:", text: "Anda dapat meminta penghapusan lengkap akun dan data terkait dengan menghubungi dukungan." },
        { label: "Ekspor:", text: "Anda dapat meminta ekspor data Anda dalam format standar." },
      ]},
      { title: "6. Cookie & Penyimpanan Lokal", body: "Kami menggunakan penyimpanan lokal browser untuk mempertahankan sesi autentikasi dan preferensi pengguna Anda. Kami tidak menggunakan cookie pelacakan pihak ketiga untuk iklan." },
      { title: "7. Perubahan Kebijakan Ini", body: "Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan akan diposting di halaman ini dengan tanggal revisi yang diperbarui. Penggunaan Layanan yang berkelanjutan merupakan penerimaan terhadap kebijakan yang direvisi." },
    ],
  },
};

type SectionItem = {
  title: string;
  body?: string;
  bold?: string;
  intro?: string;
  list?: (string | { label: string; text: string })[];
  after?: string;
  link?: string;
  linkLabel?: string;
};

function Section({ s }: { s: SectionItem }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{s.title}</h2>
      {s.body && (
        <p className="text-muted-foreground leading-relaxed">
          {s.body}
          {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-primary font-medium">{s.linkLabel}</a>}
          {s.after && s.after}
        </p>
      )}
      {s.bold && <p className="text-muted-foreground leading-relaxed font-semibold">{s.bold}</p>}
      {s.intro && <p className="text-muted-foreground leading-relaxed">{s.intro}</p>}
      {s.list && (
        <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
          {s.list.map((item, i) =>
            typeof item === "string" ? (
              <li key={i}>{item}</li>
            ) : (
              <li key={i}><strong>{item.label}</strong> {item.text}</li>
            )
          )}
        </ul>
      )}
      {s.after && !s.body && <p className="text-muted-foreground leading-relaxed">{s.after}</p>}
    </section>
  );
}

export default function TermsConditions() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
  const t = content[lang];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur px-4 sm:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{t.legal}</h1>
            <p className="text-xs text-muted-foreground">{t.lastUpdated}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            <button
              onClick={() => setLang("en")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${lang === "en" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Globe className="h-3.5 w-3.5" /> EN
            </button>
            <button
              onClick={() => setLang("id")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${lang === "id" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Globe className="h-3.5 w-3.5" /> ID
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <Tabs defaultValue="terms" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-8">
            <TabsTrigger value="terms" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-4 w-4" /> {t.tabs.terms}
            </TabsTrigger>
            <TabsTrigger value="refund" className="gap-1.5 text-xs sm:text-sm">
              <RotateCcw className="h-4 w-4" /> {t.tabs.refund}
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="h-4 w-4" /> {t.tabs.privacy}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terms" className="space-y-8 text-foreground">
            {t.terms.map((s, i) => <Section key={i} s={s} />)}
          </TabsContent>

          <TabsContent value="refund" className="space-y-8 text-foreground">
            {t.refund.map((s, i) => <Section key={i} s={s} />)}
          </TabsContent>

          <TabsContent value="privacy" className="space-y-8 text-foreground">
            {t.privacy.map((s, i) => <Section key={i} s={s} />)}
          </TabsContent>
        </Tabs>

        <div className="mt-10 pt-8 border-t border-border/40 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            {t.contact} <span className="text-primary font-medium">support@myopenedge.com</span>
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MyOpenEdge. {t.rights}
          </p>
        </div>
      </main>
    </div>
  );
}