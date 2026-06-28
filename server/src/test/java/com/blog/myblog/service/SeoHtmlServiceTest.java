package com.blog.myblog.service;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.dto.CategoryDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SeoHtmlServiceTest {

    @TempDir
    private Path tempDir;

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
