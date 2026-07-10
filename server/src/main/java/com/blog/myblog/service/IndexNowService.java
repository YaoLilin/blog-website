package com.blog.myblog.service;

import com.blog.myblog.entity.Article;
import com.blog.myblog.repository.ArticleRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IndexNowService {

    private final ArticleRepository articleRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.frontend.dist.path:/opt/myblog/dist}")
    private String frontendDistPath;

    @Value("${app.site.base-url:}")
    private String siteBaseUrl;

    @Value("${app.index-now.enabled:false}")
    private boolean enabled;

    @Value("${app.index-now.key:}")
    private String key;

    @Value("${app.index-now.endpoint:https://www.bing.com/indexnow}")
    private String endpoint;

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "index-now");
        thread.setDaemon(true);
        return thread;
    });

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        syncKeyFile();
    }

    public void submitArticle(Long articleId) {
        if (articleId == null || !isConfigured()) {
            return;
        }
        submitUrls(List.of(buildArticleUrl(articleId)));
    }

    public void submitArticles(Collection<Long> articleIds) {
        if (articleIds == null || articleIds.isEmpty() || !isConfigured()) {
            return;
        }
        List<String> urls = articleIds.stream()
                .filter(id -> id != null)
                .map(this::buildArticleUrl)
                .toList();
        submitUrls(urls);
    }

    public void submitAllArticles() {
        if (!isConfigured()) {
            return;
        }
        List<String> urls = articleRepository.findAll().stream()
                .map(Article::getId)
                .filter(id -> id != null)
                .map(this::buildArticleUrl)
                .toList();
        submitUrls(urls);
    }

    public void syncKeyFile() {
        if (!isConfigured()) {
            return;
        }

        try {
            Path distDir = Path.of(frontendDistPath);
            Files.createDirectories(distDir);
            Files.writeString(
                    distDir.resolve(keyFileName()),
                    sanitizedKey(),
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE
            );
        } catch (IOException e) {
            log.warn("写入 IndexNow key 文件失败: {}", keyFileName(), e);
        }
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }

    private void submitUrls(List<String> urls) {
        if (!isConfigured()) {
            return;
        }

        Set<String> distinct = urls.stream()
                .filter(url -> url != null && !url.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (distinct.isEmpty()) {
            return;
        }

        syncKeyFile();
        executor.submit(() -> doSubmit(List.copyOf(distinct)));
    }

    private void doSubmit(List<String> urls) {
        try {
            URI baseUri = normalizedBaseUri();
            String requestBody = objectMapper.writeValueAsString(Map.of(
                    "host", resolveHost(baseUri),
                    "key", sanitizedKey(),
                    "keyLocation", keyLocation(baseUri),
                    "urlList", urls
            ));

            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("IndexNow 提交失败: status={}, body={}", response.statusCode(), response.body());
                return;
            }
            log.info("IndexNow 提交成功，URL 数量: {}", urls.size());
        } catch (JsonProcessingException e) {
            log.warn("IndexNow 请求体序列化失败", e);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("IndexNow 提交失败", e);
        } catch (IllegalStateException e) {
            log.warn("IndexNow 配置无效: {}", e.getMessage());
        }
    }

    private boolean isConfigured() {
        return enabled
                && !sanitizedKey().isBlank()
                && !safeBaseUrl().isBlank();
    }

    private String buildArticleUrl(Long articleId) {
        URI baseUri = normalizedBaseUri();
        return baseUri.toString() + "/articles/" + articleId;
    }

    private URI normalizedBaseUri() {
        String baseUrl = safeBaseUrl();
        if (baseUrl.isBlank()) {
            throw new IllegalStateException("app.site.base-url 未配置");
        }
        String normalized = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        try {
            return new URI(normalized);
        } catch (URISyntaxException e) {
            throw new IllegalStateException("app.site.base-url 非法: " + normalized, e);
        }
    }

    private String resolveHost(URI baseUri) {
        if (baseUri.getHost() == null || baseUri.getHost().isBlank()) {
            throw new IllegalStateException("app.site.base-url 缺少 host");
        }
        return baseUri.getHost();
    }

    private String keyLocation(URI baseUri) {
        return baseUri + "/" + keyFileName();
    }

    private String keyFileName() {
        return sanitizedKey() + ".txt";
    }

    private String sanitizedKey() {
        return key == null ? "" : key.trim();
    }

    private String safeBaseUrl() {
        return siteBaseUrl == null ? "" : siteBaseUrl.trim();
    }
}
