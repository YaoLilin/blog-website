package com.blog.myblog.service;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.dto.CategoryDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SeoHtmlServiceTest {

    @TempDir
    private Path tempDir;

    @Test
    void articleApiAndSeoHtmlShareOneSummaryWithoutDuplicateMeta() throws Exception {
        Files.writeString(tempDir.resolve("index.html"), """
                <html><head><title>博客</title>
                <meta name="description" content="旧摘要" />
                <meta content="另一条旧摘要" name="description" />
                <meta property="og:description" content="个人博客" />
                <meta content="旧标题" property="og:title" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="旧地址" />
                </head><body><div id="root"></div></body></html>
                """);
        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", tempDir.toString());
        ArticleDto article = article("短标题");
        article.setCreatedAt(null);
        article.setUpdatedAt(null);
        article.setContent("# 工具介绍\n<!-- 隐藏 -->\n```java\n秘密代码\n```\n"
                + "使用 [e10-cli](https://example.com) 自动搭建应用。".repeat(15));
        ObjectMapper mapper = new ObjectMapper();
        String summary = mapper.readTree(mapper.writeValueAsString(article)).get("description").asText();
        assertEquals(160, summary.codePointCount(0, summary.length()));
        assertTrue(summary.contains("e10-cli"));
        assertTrue(!summary.contains("秘密代码") && !summary.contains("隐藏"));
        String html = service.renderArticlePage(article, "https://example.com/articles/75");
        assertTrue(html.contains("<meta name=\"description\" content=\"" + summary + "\" />"));
        assertTrue(html.contains("<meta property=\"og:description\" content=\"" + summary + "\" />"));
        assertTrue(html.contains("\"description\": \"" + summary + "\""));
        for (String key : new String[]{"description", "og:description", "og:title", "og:type", "og:url"}) {
            assertEquals(1, Pattern.compile("<meta[^>]*(?:name|property)=\"" + key + "\"")
                    .matcher(html).results().count(), key);
        }
        ArticleDto input = mapper.readValue("{\"content\":\"真实正文\",\"description\":\"伪造摘要\"}", ArticleDto.class);
        assertEquals("真实正文", input.getDescription());
    }

    @Test
    void fallbackShellStillContainsDescription() {
        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", tempDir.resolve("missing").toString());
        ArticleDto article = article("短标题");
        article.setContent("中文😀".repeat(80));
        String summary = article.getDescription();
        assertEquals(160, summary.codePointCount(0, summary.length()));
        assertTrue(!Character.isHighSurrogate(summary.charAt(summary.length() - 1)));
        assertTrue(service.renderArticlePage(article, "https://example.com/articles/75")
                .contains("<meta name=\"description\" content=\"" + summary + "\" />"));
        article.setContent("<!-- 空正文 --> ![截图](test.png)");
        assertEquals("文章正文暂无可用摘要。", article.getDescription());
    }

    @Test
    void renderArticlePageUsesConfiguredSiteNameInTitle() throws Exception {
        Path distDir = tempDir.resolve("dist");
        Files.createDirectories(distDir);
        Files.writeString(distDir.resolve("index.html"), """
                <!doctype html>
                <html lang="zh-CN">
                  <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <meta name="description" content="old" />
                    <title>个人博客</title>
                  </head>
                  <body>
                    <div id="root"></div>
                    <script type="module" src="/assets/index.js"></script>
                  </body>
                </html>
                """);

        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", distDir.toString());
        ReflectionTestUtils.setField(service, "siteName", "姚礼林的博客");
        ReflectionTestUtils.setField(service, "siteAuthor", "姚礼林");

        ArticleDto article = article("测试文章");
        String html = service.renderArticlePage(article, "https://yaolilin.com/articles/75");

        assertTrue(html.contains("<title>测试文章 - 姚礼林的博客</title>"));
        assertTrue(html.contains("content=\"测试文章 - 姚礼林的博客\""));
        assertTrue(html.contains("<script type=\"module\" src=\"/assets/index.js\"></script>"));
    }

    @Test
    void renderArticlePageFallsBackToDefaultSiteNameWhenConfigMissing() {
        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", tempDir.resolve("missing-dist").toString());
        ReflectionTestUtils.setField(service, "siteName", "");
        ReflectionTestUtils.setField(service, "siteAuthor", "姚礼林");

        ArticleDto article = article("测试文章");
        String html = service.renderArticlePage(article, "https://yaolilin.com/articles/75");

        assertTrue(html.contains("<title>测试文章 - 个人博客</title>"));
    }

    @Test
    void renderArticlePageUsesFullCategoryPathInTitle() throws Exception {
        Path distDir = tempDir.resolve("dist-path");
        Files.createDirectories(distDir);
        Files.writeString(distDir.resolve("index.html"), """
                <!doctype html>
                <html lang="zh-CN">
                  <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <meta name="description" content="old" />
                    <title>个人博客</title>
                  </head>
                  <body>
                    <div id="root"></div>
                  </body>
                </html>
                """);

        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", distDir.toString());
        ReflectionTestUtils.setField(service, "siteName", "姚礼林的博客");
        ReflectionTestUtils.setField(service, "siteAuthor", "姚礼林");

        ArticleDto article = article("后端开发知识");
        CategoryDto category = new CategoryDto();
        category.setName("E9");
        category.setFilePath("泛微开发/E9");
        article.setCategory(category);

        String html = service.renderArticlePage(article, "https://yaolilin.com/articles/96");

        assertTrue(html.contains("<title>泛微开发 &gt; E9 &gt; 后端开发知识 - 姚礼林的博客</title>"));
        assertTrue(html.contains("content=\"泛微开发 &gt; E9 &gt; 后端开发知识 - 姚礼林的博客\""));
    }

    private static ArticleDto article(String title) {
        ArticleDto article = new ArticleDto();
        article.setTitle(title);
        article.setContent("正文内容");
        article.setCreatedAt(LocalDateTime.of(2026, 6, 27, 12, 0));
        article.setUpdatedAt(LocalDateTime.of(2026, 6, 27, 12, 0));
        return article;
    }
}
