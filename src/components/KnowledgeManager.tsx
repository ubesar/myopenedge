import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// @ts-ignore - some tables not in generated types
const sb: any = supabase as any;
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Save, BookOpen, X, Pencil, Link, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface KnowledgeManagerProps {
  open: boolean;
  onClose: () => void;
}

const KnowledgeManager = ({ open, onClose }: KnowledgeManagerProps) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"manual" | "url">("manual");
  const [urlInput, setUrlInput] = useState("");
  const [scraping, setScraping] = useState(false);

  const fetchEntries = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_knowledge")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Gagal memuat knowledge");
    } else {
      setEntries((data as KnowledgeEntry[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchEntries();
  }, [open, user]);

  const handleScrapeUrl = async () => {
    if (!urlInput.trim()) {
      toast.error("URL wajib diisi");
      return;
    }
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-url", {
        body: { url: urlInput.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTitle(data.title || "");
      setContent(data.content || "");
      setFormMode("manual"); // switch to manual so user can review/edit
      toast.success("Konten berhasil diambil — review & simpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal mengambil konten dari URL");
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    if (!user || !title.trim() || !content.trim()) {
      toast.error("Title dan content wajib diisi");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("ai_knowledge")
        .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
        .eq("id", editingId)
        .eq("user_id", user.id);
      if (error) toast.error("Gagal update");
      else toast.success("Knowledge updated");
    } else {
      const { error } = await supabase
        .from("ai_knowledge")
        .insert({ user_id: user.id, title: title.trim(), content: content.trim() });
      if (error) toast.error("Gagal menyimpan");
      else toast.success("Knowledge saved");
    }

    cancelForm();
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("ai_knowledge")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) toast.error("Gagal menghapus");
    else {
      toast.success("Knowledge dihapus");
      fetchEntries();
    }
  };

  const startEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setFormMode("manual");
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormMode("manual");
    setTitle("");
    setContent("");
    setUrlInput("");
  };

  const openUrlForm = () => {
    setFormMode("url");
    setShowForm(true);
    setEditingId(null);
    setTitle("");
    setContent("");
  };

  const openManualForm = () => {
    setFormMode("manual");
    setShowForm(true);
    setEditingId(null);
    setTitle("");
    setContent("");
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Custom Knowledge Base</h2>
                <p className="text-[10px] text-muted-foreground">{entries.length} entries · AI will use this context</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {showForm && formMode === "url" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <Link className="h-3.5 w-3.5" />
                  Import dari URL
                </div>
                <Input
                  placeholder="https://www.edgeful.com/blog/posts/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="text-sm h-9"
                  disabled={scraping}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelForm} className="text-xs" disabled={scraping}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleScrapeUrl} className="text-xs gap-1.5" disabled={scraping}>
                    {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                    {scraping ? "Mengambil..." : "Ambil Konten"}
                  </Button>
                </div>
              </div>
            )}

            {showForm && formMode === "manual" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <Input
                  placeholder="Title (e.g. NQ Trading Rules)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm h-9"
                />
                <Textarea
                  placeholder="Content — catatan, rules, atau insight yang ingin AI ketahui..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="text-sm min-h-[100px]"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelForm} className="text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} className="text-xs gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {editingId ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-8">Loading...</p>
            ) : entries.length === 0 && !showForm ? (
              <div className="text-center py-10">
                <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Belum ada knowledge</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tambahkan catatan, rules, atau insight pribadi yang akan digunakan AI saat menjawab.</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border/40 bg-card p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{entry.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{entry.content}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(entry)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {!showForm && (
            <div className="px-4 py-3 border-t border-border/40 flex gap-2">
              <Button size="sm" variant="outline" onClick={openManualForm} className="flex-1 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Manual
              </Button>
              <Button size="sm" variant="outline" onClick={openUrlForm} className="flex-1 text-xs gap-1.5">
                <Link className="h-3.5 w-3.5" /> Dari URL
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default KnowledgeManager;
