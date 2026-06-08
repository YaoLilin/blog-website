package com.blog.myblog.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BrowserRequestDetectorTest {

    @Test
    void acceptsCommonBrowserUserAgents() {
        assertTrue(BrowserRequestDetector.isBrowserUserAgent(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"));
        assertTrue(BrowserRequestDetector.isBrowserUserAgent(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
                        + "(KHTML, like Gecko) Version/17.0 Safari/605.1.15"));
        assertTrue(BrowserRequestDetector.isBrowserUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0"));
        assertTrue(BrowserRequestDetector.isBrowserUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0"));
    }

    @Test
    void rejectsNonBrowserAndBotUserAgents() {
        assertFalse(BrowserRequestDetector.isBrowserUserAgent(null));
        assertFalse(BrowserRequestDetector.isBrowserUserAgent(""));
        assertFalse(BrowserRequestDetector.isBrowserUserAgent("curl/8.7.1"));
        assertFalse(BrowserRequestDetector.isBrowserUserAgent("PostmanRuntime/7.39.0"));
        assertFalse(BrowserRequestDetector.isBrowserUserAgent("Java/18.0.1"));
        assertFalse(BrowserRequestDetector.isBrowserUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)"));
    }
}
