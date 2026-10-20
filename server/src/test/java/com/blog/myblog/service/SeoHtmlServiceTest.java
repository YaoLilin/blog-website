package com.blog.myblog.service;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.dto.CategoryDto;
import com.blog.myblog.dto.HomeSeoDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SeoHtmlServiceTest {

    @TempDir
    private Path tempDir;

    @Test
    void homeHtmlContainsIdentityRealLinksAndOneCanonicalBeforeJavaScript() throws Exception {
        Files.writeString(tempDir.resolve("index.html"), """
                <html><head><title>博客</title><meta name="description" content="旧摘要">
                <link rel="canonical" href="https://old.example/">
                <meta property="og:title" content="旧标题"></head>
                <body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>
                """);
        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", tempDir.toString());
        ReflectionTestUtils.setField(service, "siteName", "姚礼林的博客");
        ReflectionTestUtils.setField(service, "siteAuthorAlias", "YaoLilin");
        ReflectionTestUtils.setField(service, "siteIntroduction", "我是姚礼林（YaoLilin），分享开发经验。");
        ReflectionTestUtils.setField(service, "siteBaseUrl", "https://yaolilin.com/");
        CategoryDto category = new CategoryDto();
        category.setId(7L);
        category.setName("开发 & 实践");
        ArticleDto article = article("<script>alert(1)</script>");
        article.setId(73L);
        article.setContent("真实文章正文摘要");

        String html = service.renderHomePage(new HomeSeoDto(List.of(category), List.of(article), List.of(article)));

        assertTrue(html.contains("<h1>YaoLilin · 姚礼林的博客</h1>"));
        assertTrue(html.contains("我是姚礼林（YaoLilin）"));
        assertTrue(html.contains("href=\"/articles/73\""));
        assertTrue(html.contains("href=\"/categories/7\""));
        assertTrue(html.contains("开发 &amp; 实践"));
        assertTrue(html.contains("真实文章正文摘要"));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("<link rel=\"canonical\" href=\"https://yaolilin.com/\" />"));
        assertEquals(1, Pattern.compile("rel=\"canonical\"").matcher(html).results().count());
        assertEquals(1, Pattern.compile("<title>").matcher(html).results().count());
        assertEquals(1, Pattern.compile("name=\"description\"").matcher(html).results().count());
        assertTrue(html.contains("src=\"/assets/app.js\""));
        assertTrue(!html.contains("old.example") && !html.contains("旧摘要"));

        String articleHtml = service.renderArticlePage(article, "https://yaolilin.com/articles/73");
        assertEquals(1, Pattern.compile("rel=\"canonical\"").matcher(articleHtml).results().count());
        assertTrue(articleHtml.contains("href=\"https://yaolilin.com/articles/73\""));
        assertTrue(!articleHtml.contains("href=\"https://yaolilin.com/\""));
    }

    @Test
    void homeAndArticleUseConfiguredAuthorAndHomeDescription() {
        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", tempDir.resolve("missing").toString());
        ReflectionTestUtils.setField(service, "siteName", "配置站点");
        ReflectionTestUtils.setField(service, "siteAuthor", "新作者\" & 测试");
        ReflectionTestUtils.setField(service, "siteAuthorAlias", "NewAuthor");
        ReflectionTestUtils.setField(service, "homeTitle", "自定义首页标题");
        ReflectionTestUtils.setField(service, "siteDescription", "配置的网站描述 <安全>");
        ReflectionTestUtils.setField(service, "siteIntroduction", "可配置的作者介绍");
        ReflectionTestUtils.setField(service, "siteBaseUrl", "https://configured.example///");

        String html = service.renderHomePage(new HomeSeoDto(List.of(), List.of(), List.of()));

        assertTrue(html.contains("<title>自定义首页标题</title>"));
        assertTrue(html.contains("name=\"author\" content=\"新作者&quot; &amp; 测试\""));
        assertTrue(html.contains("name=\"description\" content=\"配置的网站描述 &lt;安全&gt;\""));
        assertTrue(html.contains("<h1>NewAuthor · 配置站点</h1>"));
        assertTrue(html.contains("可配置的作者介绍"));
        assertTrue(html.contains("href=\"https://configured.example/\""));
        assertTrue(!html.contains("姚礼林") && !html.contains("YaoLilin"));

        ArticleDto article = article("文章标题");
        article.setContent("文章自己的正文摘要");
        String articleHtml = service.renderArticlePage(article, "https://configured.example/articles/75");
        assertTrue(articleHtml.contains("name=\"author\" content=\"新作者&quot; &amp; 测试\""));
        assertTrue(articleHtml.contains("name=\"description\" content=\"文章自己的正文摘要\""));
    }

    @Test
    void articleApiAndSeoHtmlShareOneSummaryWithoutDuplicateMeta() throws Exception {
        Files.writeString(tempDir.resolve("index.html"), """
                <html><head><title>博客</title><title>旧标题</title><title>博客</title>
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
        assertEquals(1, Pattern.compile("<title>").matcher(html).results().count());
        assertTrue(html.contains("<title>" + article.getSeoTitle() + " - 个人博客</title>"));
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
    void markdownImagesKeepExistingAltAndUseHeadingOrArticleTitleForEmptyAlt() {
        SeoHtmlService service = new SeoHtmlService();
        ReflectionTestUtils.setField(service, "frontendDistPath", tempDir.resolve("missing").toString());
        ArticleDto article = article("开发指南");
        article.setContent("![](/cover.png)\n\n## 环境搭建\n\n![](/empty.png)\n"
                + "![已有说明](/named.png)\n\n# 接口调试\n\n![  ](/space.png)");
        String html = service.renderArticlePage(article, "https://example.com/articles/75");
        assertTrue(html.contains("src=\"/cover.png\" alt=\"开发指南配图\""));
        assertTrue(html.contains("src=\"/empty.png\" alt=\"环境搭建配图\""));
        assertTrue(html.contains("src=\"/named.png\" alt=\"已有说明\""));
        assertTrue(html.contains("src=\"/space.png\" alt=\"接口调试配图\""));
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
