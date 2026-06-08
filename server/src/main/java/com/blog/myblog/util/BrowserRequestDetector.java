package com.blog.myblog.util;

import java.util.Locale;

public final class BrowserRequestDetector {

    private BrowserRequestDetector() {
    }

    public static boolean isBrowserUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return false;
        }

        String normalized = userAgent.toLowerCase(Locale.ROOT);
        if (containsAny(normalized, "bot", "crawler", "spider", "curl", "wget", "postman",
                "insomnia", "httpclient", "okhttp", "python-requests", "java/")) {
            return false;
        }

        return containsAny(normalized, "chrome/", "chromium/", "firefox/", "safari/",
                "edg/", "opr/", "opera/", "msie ", "trident/");
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle)) {
                return true;
            }
        }
        return false;
    }
}
