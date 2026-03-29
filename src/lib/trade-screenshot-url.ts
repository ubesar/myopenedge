import { supabase } from "@/integrations/supabase/client";

const TRADE_SCREENSHOT_BUCKET = "trade-screenshots";
const PUBLIC_PREFIX = `/storage/v1/object/public/${TRADE_SCREENSHOT_BUCKET}/`;
const SIGNED_PREFIX = `/storage/v1/object/sign/${TRADE_SCREENSHOT_BUCKET}/`;

const trimLeadingSlash = (value: string) => value.replace(/^\/+/, "");

export const extractTradeScreenshotPath = (storedValue: string): string | null => {
  if (!storedValue) return null;

  if (storedValue.startsWith("data:") || storedValue.startsWith("blob:")) {
    return null;
  }

  if (/^https?:\/\//i.test(storedValue)) {
    try {
      const url = new URL(storedValue);
      const pathname = decodeURIComponent(url.pathname);

      const publicIdx = pathname.indexOf(PUBLIC_PREFIX);
      if (publicIdx >= 0) {
        return trimLeadingSlash(pathname.slice(publicIdx + PUBLIC_PREFIX.length));
      }

      const signedIdx = pathname.indexOf(SIGNED_PREFIX);
      if (signedIdx >= 0) {
        return trimLeadingSlash(pathname.slice(signedIdx + SIGNED_PREFIX.length));
      }

      return null;
    } catch {
      return null;
    }
  }

  return trimLeadingSlash(storedValue);
};

export const resolveTradeScreenshotUrl = async (storedValue: string): Promise<string> => {
  if (!storedValue) return "";

  if (storedValue.startsWith("data:") || storedValue.startsWith("blob:")) {
    return storedValue;
  }

  const path = extractTradeScreenshotPath(storedValue);
  if (!path) return storedValue;

  const { data: signedData, error: signedError } = await supabase.storage
    .from(TRADE_SCREENSHOT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  if (/^https?:\/\//i.test(storedValue)) {
    return storedValue;
  }

  const { data: publicData } = supabase.storage
    .from(TRADE_SCREENSHOT_BUCKET)
    .getPublicUrl(path);

  return publicData.publicUrl;
};
