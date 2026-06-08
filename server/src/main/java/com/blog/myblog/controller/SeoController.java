package com.blog.myblog.controller;

import com.blog.myblog.entity.Article;
import com.blog.myblog.entity.Category;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@RestController
@RequiredArgsConstructor
public class SeoController {

    private final ArticleRepository articleRepository;
    private final CategoryRepository categoryRepository;

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> robots(HttpServletRequest request) {
        String baseUrl = resolveBaseUrl(request);
        String body = """
                User-agent: *
                Allow: /
                Disallow: /login
                Disallow: /admin/

                Sitemap: %s/sitemap.xml
                """.formatted(baseUrl);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS))
                .body(body);
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap(HttpServletRequest request) {
        String baseUrl = resolveBaseUrl(request);
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        appendUrl(xml, baseUrl + "/", null, "daily", "1.0");
        appendUrl(xml, baseUrl + "/categories", null, "weekly", "0.8");
        appendUrl(xml, baseUrl + "/recent", null, "daily", "0.8");

        categoryRepository.findAll().stream()
                .filter(category -> category.getId() != null)
                .sorted((a, b) -> a.getId().compareTo(b.getId()))
                .forEach(category -> appendCategoryUrl(xml, baseUrl, category));

        articleRepository.findAll().stream()
                .filter(article -> article.getId() != null)
                .sorted((a, b) -> a.getId().compareTo(b.getId()))
                .forEach(article -> appendArticleUrl(xml, baseUrl, article));

        xml.append("</urlset>\n");

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS))
                .body(xml.toString());
    }

    private void appendCategoryUrl(StringBuilder xml, String baseUrl, Category category) {
        appendUrl(xml, baseUrl + "/categories/" + category.getId(), null, "weekly", "0.7");
    }

    private void appendArticleUrl(StringBuilder xml, String baseUrl, Article article) {
        LocalDateTime lastModified = article.getUpdatedAt() != null ? article.getUpdatedAt() : article.getCreatedAt();
        appendUrl(xml, baseUrl + "/articles/" + article.getId(), lastModified, "monthly", "0.9");
    }

    private void appendUrl(StringBuilder xml, String loc, LocalDateTime lastModified, String changeFreq, String priority) {
        xml.append("  <url>\n");
        xml.append("    <loc>").append(escapeXml(loc)).append("</loc>\n");
        if (lastModified != null) {
            xml.append("    <lastmod>")
                    .append(lastModified.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE))
                    .append("</lastmod>\n");
        }
        xml.append("    <changefreq>").append(changeFreq).append("</changefreq>\n");
        xml.append("    <priority>").append(priority).append("</priority>\n");
        xml.append("  </url>\n");
    }

    private String resolveBaseUrl(HttpServletRequest request) {
        String scheme = firstHeaderValue(request.getHeader("X-Forwarded-Proto"));
        if (scheme == null || scheme.isBlank()) {
            scheme = request.getScheme();
        }

        String host = firstHeaderValue(request.getHeader("X-Forwarded-Host"));
        if (host == null || host.isBlank()) {
            host = firstHeaderValue(request.getHeader("Host"));
        }
        if (host == null || host.isBlank()) {
            host = request.getServerName();
            int port = request.getServerPort();
            if (port > 0 && port != 80 && port != 443) {
                host = host + ":" + port;
            }
        }

        return scheme + "://" + host;
    }

    private String firstHeaderValue(String value) {
        if (value == null) {
            return null;
        }
        int comma = value.indexOf(',');
        return comma >= 0 ? value.substring(0, comma).trim() : value.trim();
    }

    private String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
