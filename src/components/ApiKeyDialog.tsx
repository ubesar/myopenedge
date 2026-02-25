import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, KeyRound } from "lucide-react";
import { toast } from "sonner";

const API_KEY = "2bde07d32cc34fec8bf468bf0149c12f";

const ApiKeyDialog = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("api_key_dialog_dismissed");
    if (!dismissed) {
      setOpen(true);
    }
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(API_KEY);
    setCopied(true);
    toast.success("API key copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      sessionStorage.setItem("api_key_dialog_dismissed", "true");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Welcome! Paste Your API Key
          </DialogTitle>
          <DialogDescription>
            Copy the API key below and paste it into the <span className="font-semibold text-foreground">Twelve Data API Key</span> field on the left panel to start analyzing.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 mt-2 p-3 rounded-lg bg-muted border border-border">
          <code className="flex-1 text-sm font-mono text-foreground break-all select-all">
            {API_KEY}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0 h-9 w-9"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Sign up for free at <a href="https://twelvedata.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">twelvedata.com</a> to get your own API key.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyDialog;
