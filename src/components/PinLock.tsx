import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PinLockProps {
  userId: string;
  onUnlock: () => void;
}

const PIN_LENGTH = 4;

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "mt5-control-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const PinLock = ({ userId, onUnlock }: PinLockProps) => {
  const [pin, setPin] = useState<string[]>([]);
  const [confirmPin, setConfirmPin] = useState<string[]>([]);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkPin();
  }, []);

  const checkPin = async () => {
    const { data } = await supabase
      .from("user_pins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    setHasPin(!!data);
    if (!data) setIsSettingUp(true);
  };

  const focusInput = () => {
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    focusInput();
  }, [hasPin, isConfirming]);

  const handleDigit = (digit: string) => {
    if (isConfirming) {
      if (confirmPin.length < PIN_LENGTH) {
        const next = [...confirmPin, digit];
        setConfirmPin(next);
        if (next.length === PIN_LENGTH) handleConfirmComplete(next);
      }
    } else {
      if (pin.length < PIN_LENGTH) {
        const next = [...pin, digit];
        setPin(next);
        if (next.length === PIN_LENGTH) {
          if (isSettingUp) {
            setIsConfirming(true);
          } else {
            handleVerify(next);
          }
        }
      }
    }
    setError("");
  };

  const handleBackspace = () => {
    if (isConfirming) {
      setConfirmPin((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= "0" && e.key <= "9") {
      handleDigit(e.key);
    } else if (e.key === "Backspace") {
      handleBackspace();
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleVerify = async (digits: string[]) => {
    setLoading(true);
    const pinStr = digits.join("");
    const hashed = await hashPin(pinStr);

    const { data } = await supabase
      .from("user_pins")
      .select("pin_hash")
      .eq("user_id", userId)
      .single();

    if (data?.pin_hash === hashed) {
      onUnlock();
    } else {
      setError("PIN salah");
      setPin([]);
      triggerShake();
    }
    setLoading(false);
  };

  const handleConfirmComplete = async (digits: string[]) => {
    const pinStr = pin.join("");
    const confirmStr = digits.join("");

    if (pinStr !== confirmStr) {
      setError("PINs do not match");
      setConfirmPin([]);
      triggerShake();
      return;
    }

    setLoading(true);
    const hashed = await hashPin(pinStr);

    const { error: dbError } = await supabase
      .from("user_pins")
      .upsert({ user_id: userId, pin_hash: hashed, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (dbError) {
      toast.error("Failed to save PIN");
      setPin([]);
      setConfirmPin([]);
      setIsConfirming(false);
    } else {
      toast.success("PIN created successfully!");
      onUnlock();
    }
    setLoading(false);
  };

  const handleRemovePin = async () => {
    setLoading(true);
    const { error: dbError } = await supabase
      .from("user_pins")
      .delete()
      .eq("user_id", userId);

    if (!dbError) {
      toast.success("PIN removed");
      setHasPin(false);
      setIsSettingUp(true);
      setPin([]);
      setConfirmPin([]);
      setIsConfirming(false);
    }
    setLoading(false);
  };

  const currentPin = isConfirming ? confirmPin : pin;

  const getTitle = () => {
    if (isSettingUp && !isConfirming) return "Create New PIN";
    if (isConfirming) return "Confirm PIN";
    return "Enter PIN";
  };

  const getSubtitle = () => {
    if (isSettingUp && !isConfirming) return "Buat 4 digit PIN untuk keamanan extra";
    if (isConfirming) return "Masukkan ulang PIN untuk konfirmasi";
    return "Masukkan PIN untuk mengakses dashboard";
  };

  if (hasPin === null) {
    return (
      <div className="min-h-screen framer-gradient-bg flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-mono text-sm">Loading...</div>
      </div>
    );
  }

  const numpadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="min-h-screen framer-gradient-bg flex items-center justify-center p-4">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="sr-only"
        onKeyDown={handleKeyDown}
        autoFocus
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-[340px] space-y-8"
        onClick={focusInput}
      >
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20">
            {isSettingUp ? (
              <KeyRound className="w-7 h-7 text-primary" />
            ) : (
              <Lock className="w-7 h-7 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">{getTitle()}</h1>
            <p className="text-muted-foreground text-sm mt-1.5">{getSubtitle()}</p>
          </div>
        </div>

        <motion.div
          animate={shake ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex justify-center gap-4"
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <motion.div
              key={i}
              animate={
                i < currentPin.length
                  ? { scale: [1, 1.3, 1], backgroundColor: "hsl(var(--primary))" }
                  : { scale: 1 }
              }
              transition={{ duration: 0.15 }}
              className={`w-4 h-4 rounded-full border-2 transition-colors duration-200 ${
                i < currentPin.length
                  ? "bg-primary border-primary"
                  : "bg-transparent border-muted-foreground/30"
              }`}
            />
          ))}
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm text-destructive font-medium"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
          {numpadKeys.map((key, i) => {
            if (key === "") return <div key={i} />;
            if (key === "del") {
              return (
                <button
                  key={i}
                  onClick={handleBackspace}
                  disabled={loading}
                  className="h-14 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-150 active:scale-95"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                    <line x1="18" y1="9" x2="12" y2="15" />
                    <line x1="12" y1="9" x2="18" y2="15" />
                  </svg>
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={() => handleDigit(key)}
                disabled={loading || currentPin.length >= PIN_LENGTH}
                className="h-14 rounded-xl framer-card-inner text-lg font-semibold text-foreground hover:bg-accent/50 transition-all duration-150 active:scale-95 disabled:opacity-30"
              >
                {key}
              </button>
            );
          })}
        </div>

        {!isSettingUp && hasPin && (
          <div className="text-center pt-2">
            <button
              onClick={handleRemovePin}
              disabled={loading}
              className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors inline-flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Hapus PIN
            </button>
          </div>
        )}

        {isSettingUp && !isConfirming && (
          <div className="text-center pt-2">
            <button
              onClick={onUnlock}
              className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              Lewati untuk sekarang
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PinLock;
