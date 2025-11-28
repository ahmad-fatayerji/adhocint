export const GA_MEASUREMENT_ID =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-YYCZ43DRN5";

export const hasMeasurementId = Boolean(GA_MEASUREMENT_ID);

function getWindowWithGtag(): (Window & { gtag?: GtagFunction }) | null {
    if (typeof window === "undefined" || !hasMeasurementId) {
        return null;
    }
    return window as Window & { gtag?: GtagFunction };
}

type GtagFunction = (
    command: "config" | "event" | "consent",
    target: string,
    params?: Record<string, any>
) => void;

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: any[]) => void;
    }
}

export function pageview(url: string) {
    const win = getWindowWithGtag();
    if (!win?.gtag) return;
    win.gtag("event", "page_view", {
        page_path: url,
        send_to: GA_MEASUREMENT_ID,
    });
}

export function trackEvent(eventName: string, params?: Record<string, any>) {
    const win = getWindowWithGtag();
    if (!win?.gtag) return;
    win.gtag("event", eventName, {
        send_to: GA_MEASUREMENT_ID,
        ...params,
    });
}

export function updateAnalyticsConsent(granted: boolean): boolean {
    const win = getWindowWithGtag();
    if (!win?.gtag) return false;
    win.gtag("consent", "update", {
        ad_storage: granted ? "granted" : "denied",
        analytics_storage: granted ? "granted" : "denied",
    });
    return true;
}
