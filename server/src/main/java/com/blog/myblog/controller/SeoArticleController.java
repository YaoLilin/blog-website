package com.blog.myblog.controller;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.service.ArticleService;
import com.blog.myblog.service.SeoHtmlService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/seo/articles")
@RequiredArgsConstructor
public class SeoArticleController {

    private final ArticleService articleService;
    private final SeoHtmlService seoHtmlService;

    @GetMapping(value = "/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> articleById(@PathVariable Long id, HttpServletRequest request) {
        ArticleDto article = articleService.getById(id);
        String canonicalUrl = seoHtmlService.canonicalForArticle(resolveBaseUrl(request), id);
        return html(seoHtmlService.renderArticlePage(article, canonicalUrl));
    }

    @GetMapping(value = "/view", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> articleByPath(@RequestParam String path, HttpServletRequest request) {
        ArticleDto article = articleService.getByFilePath(path);
        String canonicalUrl = article.getId() != null
                ? seoHtmlService.canonicalForArticle(resolveBaseUrl(request), article.getId())
                : seoHtmlService.canonicalForPath(resolveBaseUrl(request), path);
        return html(seoHtmlService.renderArticlePage(article, canonicalUrl));
    }

    private ResponseEntity<String> html(String body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES))
                .contentType(MediaType.TEXT_HTML)
                .body(body);
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
}
