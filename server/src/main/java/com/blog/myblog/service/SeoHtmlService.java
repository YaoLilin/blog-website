package com.blog.myblog.service;

import com.blog.myblog.datasource.ReadDb;
import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.dto.HomeSeoDto;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@ReadDb
@RequiredArgsConstructor
public class SeoHtmlService {

    private static final Pattern TITLE_PATTERN = Pattern.compile("(?is)<title>.*?</title>");
    private static final Pattern ARTICLE_META_PATTERN = Pattern.compile(
            "(?is)<meta\\b(?=[^>]*\\b(?:name\\s*=\\s*[\"'](?:description|author)[\"']|property\\s*=\\s*[\"']og:(?:title|description|type|url)[\"']))[^>]*>");
    private static final Pattern ROOT_PATTERN = Pattern.compile("(?is)<div\\s+id=[\"']root[\"']\\s*>\\s*</div>");
    private static final Pattern CANONICAL_PATTERN = Pattern.compile("(?is)<link\\b(?=[^>]*\\brel\\s*=\\s*[\"']canonical[\"'])[^>]*>");
    private static final Pattern MARKDOWN_IMAGE_PATTERN = Pattern.compile("!\\[([^\\]]*)]\\(([^\\s)]+)(?:\\s+[^)]*)?\\)");
    private static final Pattern MARKDOWN_LINK_PATTERN = Pattern.compile("(?<!!)\\[([^\\]]+)]\\(([^\\s)]+)(?:\\s+[^)]*)?\\)");

    @Value("${app.frontend.dist.path:/opt/myblog/dist}")
    private String frontendDistPath;

    @Value("${app.site.name:个人博客}")
    private String siteName;

    @Value("${app.site.author:博主}")
    private String siteAuthor;

    @Value("${app.site.author-alias:}")
    private String siteAuthorAlias;

    @Value("${app.site.description:个人博客}")
    private String siteDescription;

    @Value("${app.site.home-title:${app.site.name:个人博客}}")
    private String homeTitle;

    @Value("${app.site.introduction:${app.site.description:个人博客}}")
    private String siteIntroduction;

    @Value("${app.site.base-url:http://localhost:5173}")
    private String siteBaseUrl;

    public String renderArticlePage(ArticleDto article, String canonicalUrl) {
        String title = article.getSeoTitle();
        String description = article.getDescription();
        String articleHtml = buildArticleHtml(article);
        String headExtras = buildHeadExtras(article, title, description, canonicalUrl);
        headExtras = "<title>" + escapeHtml(title + " - " + safeSiteName()) + "</title>\n" + headExtras;
        return renderShell(headExtras, articleHtml);
    }

    public String renderHomePage(HomeSeoDto home) {
        String title = homeTitle == null || homeTitle.isBlank() ? safeSiteName() : homeTitle.trim();
        String description = siteDescription == null || siteDescription.isBlank() ? safeSiteName() : siteDescription.trim();
        String introduction = siteIntroduction == null || siteIntroduction.isBlank() ? description : siteIntroduction.trim();
        String heading = siteAuthorAlias == null || siteAuthorAlias.isBlank()
                ? safeSiteName() : siteAuthorAlias.trim() + " · " + safeSiteName();
        String url = siteBaseUrl == null || siteBaseUrl.isBlank() ? "http://localhost:5173/"
                : siteBaseUrl.trim().replaceAll("/+$", "") + "/";
        String head = """
                <title>%s</title>
                <meta name="author" content="%s" />
                <meta name="description" content="%s" />
                <link rel="canonical" href="%s" />
                <meta property="og:title" content="%s" />
                <meta property="og:description" content="%s" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="%s" />
                """.formatted(escapeHtml(title), escapeHtmlAttribute(safeSiteAuthor()), escapeHtmlAttribute(description),
                escapeHtmlAttribute(url), escapeHtmlAttribute(title), escapeHtmlAttribute(description), escapeHtmlAttribute(url));
        StringBuilder body = new StringBuilder("<main><header id=\"site-introduction\" hidden><h1>")
                .append(escapeHtml(heading)).append("</h1><p>")
                .append(escapeHtml(introduction))
                .append("</p></header><nav><a href=\"/categories\">文章分类</a> · ")
                .append("<a href=\"/recent\">最近文章</a></nav>")
                .append("<section><h2>泛微开发知识</h2><p>由我编写的泛微开发手册，包含前端和后端，E9 和 E10 两个系统，以及多个实用案例。</p>")
                .append("<a href=\"/articles/view?path=")
                .append(URLEncoder.encode("/api/docs-static/泛微开发/README.md", StandardCharsets.UTF_8))
                .append("\">立即阅读</a></section><section><h2>文章分类</h2><ul>");
        home.categories().stream().filter(category -> category.getId() != null).forEach(category -> body
                .append("<li><a href=\"/categories/").append(category.getId()).append("\">")
                .append(escapeHtml(category.getName())).append("</a></li>"));
        body.append("</ul></section>");
        appendHomeArticles(body, "推荐文章", home.recommendedArticles());
        appendHomeArticles(body, "最近文章", home.recentArticles());
        body.append("</main>");
        return renderShell(head, body.toString());
    }

    private void appendHomeArticles(StringBuilder body, String heading, java.util.List<ArticleDto> articles) {
        body.append("<section><h2>").append(heading).append("</h2><ul>");
        articles.stream().filter(article -> article.getId() != null).forEach(article -> body
                .append("<li><a href=\"/articles/").append(article.getId()).append("\">")
                .append(escapeHtml(safeTitle(article))).append("</a><p>")
                .append(escapeHtml(article.getDescription())).append("</p></li>"));
        body.append("</ul></section>");
    }

    private String renderShell(String headExtras, String body) {
        String html = TITLE_PATTERN.matcher(readIndexHtml()).replaceAll("");
        html = ARTICLE_META_PATTERN.matcher(html).replaceAll("");
        html = CANONICAL_PATTERN.matcher(html).replaceAll("");
        html = html.replace("</head>", headExtras + "\n  </head>");

        String root = "<div id=\"root\">\n" + body + "\n    </div>";
        html = ROOT_PATTERN.matcher(html).replaceFirst(Matcher.quoteReplacement(root));
        return html;
    }

    private String readIndexHtml() {
        Path indexPath = Path.of(frontendDistPath, "index.html");
        try {
            return Files.readString(indexPath, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return """
                    <!doctype html>
                    <html lang="zh-CN">
                      <head>
                        <meta charset="UTF-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                        <title>%s</title>
                      </head>
                      <body>
                        <div id="root"></div>
                      </body>
                    </html>
                    """.formatted(escapeHtml(safeSiteName()));
        }
    }

    private String buildHeadExtras(ArticleDto article, String title, String description, String canonicalUrl) {
        String published = article.getCreatedAt() == null ? "" : article.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String modified = article.getUpdatedAt() == null ? published : article.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String jsonLd = """
                {
                  "@context": "https://schema.org",
                  "@type": "BlogPosting",
                  "headline": "%s",
                  "description": "%s",
                  "datePublished": "%s",
                  "dateModified": "%s",
                  "author": {
                    "@type": "Person",
                    "name": "%s"
                  }
                }
                """.formatted(
                escapeJson(title),
                escapeJson(description),
                escapeJson(published),
                escapeJson(modified),
                escapeJson(safeSiteAuthor())
        );

        return """
                <meta name="author" content="%s" />
                <meta name="description" content="%s" />
                <link rel="canonical" href="%s" />
                <meta property="og:title" content="%s - %s" />
                <meta property="og:description" content="%s" />
                <meta property="og:type" content="article" />
                <meta property="og:url" content="%s" />
                <script type="application/ld+json">%s</script>
                """.formatted(
                escapeHtmlAttribute(safeSiteAuthor()),
                escapeHtmlAttribute(description),
                escapeHtmlAttribute(canonicalUrl),
                escapeHtmlAttribute(title),
                escapeHtmlAttribute(safeSiteName()),
                escapeHtmlAttribute(description),
                escapeHtmlAttribute(canonicalUrl),
                jsonLd
        );
    }

    private String buildArticleHtml(ArticleDto article) {
        String published = article.getCreatedAt() == null ? "" : article.getCreatedAt().toLocalDate().toString();
        return """
                    <main class="seo-article" style="max-width: 768px; margin: 0 auto; padding: 32px 24px; line-height: 1.75;">
                      <article>
                        <h1 style="font-size: 32px; line-height: 1.25; margin: 0 0 12px;">%s</h1>
                        <p style="color: #71717a; margin: 0 0 28px;">%s</p>
                        <div class="seo-article-content">%s</div>
                      </article>
                    </main>""".formatted(
                escapeHtml(safeTitle(article)),
                published.isBlank() ? escapeHtml(safeSiteName()) : "发布于 " + escapeHtml(published),
                renderMarkdown(article.getContent(), safeTitle(article))
        );
    }

    private String renderMarkdown(String markdown, String articleTitle) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }

        StringBuilder html = new StringBuilder();
        StringBuilder paragraph = new StringBuilder();
        boolean inCodeBlock = false;
        StringBuilder code = new StringBuilder();
        String imageContext = articleTitle;

        for (String rawLine : markdown.replace("\r\n", "\n").split("\n")) {
            String line = rawLine.stripTrailing();
            if (line.startsWith("```") || line.startsWith("~~~")) {
                flushParagraph(html, paragraph, imageContext);
                if (inCodeBlock) {
                    html.append("<pre><code>").append(escapeHtml(code.toString())).append("</code></pre>\n");
                    code.setLength(0);
                    inCodeBlock = false;
                } else {
                    inCodeBlock = true;
                }
                continue;
            }
            if (inCodeBlock) {
                code.append(rawLine).append('\n');
                continue;
            }
            if (line.isBlank()) {
                flushParagraph(html, paragraph, imageContext);
                continue;
            }

            Matcher heading = Pattern.compile("^(#{1,6})\\s+(.+)$").matcher(line);
            if (heading.matches()) {
                flushParagraph(html, paragraph, imageContext);
                int level = heading.group(1).length();
                imageContext = heading.group(2).replaceAll("[*_`]", "").trim();
                html.append("<h").append(level).append(">")
                        .append(renderInlineMarkdown(heading.group(2), imageContext))
                        .append("</h").append(level).append(">\n");
                continue;
            }

            Matcher unordered = Pattern.compile("^[-*+]\\s+(.+)$").matcher(line);
            if (unordered.matches()) {
                flushParagraph(html, paragraph, imageContext);
                html.append("<ul><li>").append(renderInlineMarkdown(unordered.group(1), imageContext)).append("</li></ul>\n");
                continue;
            }

            if (!paragraph.isEmpty()) {
                paragraph.append(' ');
            }
            paragraph.append(line);
        }

        if (inCodeBlock) {
            html.append("<pre><code>").append(escapeHtml(code.toString())).append("</code></pre>\n");
        }
        flushParagraph(html, paragraph, imageContext);
        return html.toString();
    }

    private void flushParagraph(StringBuilder html, StringBuilder paragraph, String imageContext) {
        if (paragraph.isEmpty()) {
            return;
        }
        html.append("<p>").append(renderInlineMarkdown(paragraph.toString(), imageContext)).append("</p>\n");
        paragraph.setLength(0);
    }

    private String renderInlineMarkdown(String text, String imageContext) {
        String escaped = escapeHtml(text);
        escaped = MARKDOWN_IMAGE_PATTERN.matcher(escaped)
                .replaceAll(match -> "<img src=\"" + escapeHtmlAttribute(match.group(2)) + "\" alt=\""
                        + (match.group(1).isBlank() ? escapeHtmlAttribute(imageContext + "配图") : match.group(1))
                        + "\" loading=\"lazy\" />");
        escaped = MARKDOWN_LINK_PATTERN.matcher(escaped)
                .replaceAll(match -> "<a href=\"" + escapeHtmlAttribute(match.group(2)) + "\">" + match.group(1) + "</a>");
        return escaped;
    }

    private String safeTitle(ArticleDto article) {
        return article.getTitle() == null || article.getTitle().isBlank() ? "文章" : article.getTitle().trim();
    }

    public String canonicalForArticle(String baseUrl, Long id) {
        return baseUrl + "/articles/" + id;
    }

    public String canonicalForPath(String baseUrl, String path) {
        return baseUrl + "/articles/view?path=" + URLEncoder.encode(path, StandardCharsets.UTF_8);
    }

    private String safeSiteName() {
        return siteName == null || siteName.isBlank() ? "个人博客" : siteName.trim();
    }

    private String safeSiteAuthor() {
        return siteAuthor == null || siteAuthor.isBlank() ? "博主" : siteAuthor.trim();
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private String escapeHtmlAttribute(String value) {
        return escapeHtml(value)
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
