package com.blog.myblog.service;

import com.blog.myblog.dto.ArticleDto;
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
@RequiredArgsConstructor
public class SeoHtmlService {

    private static final Pattern TITLE_PATTERN = Pattern.compile("(?is)<title>.*?</title>");
    private static final Pattern DESCRIPTION_PATTERN = Pattern.compile("(?is)<meta\\s+name=[\"']description[\"'][^>]*>");
    private static final Pattern ROOT_PATTERN = Pattern.compile("(?is)<div\\s+id=[\"']root[\"']\\s*>\\s*</div>");
    private static final Pattern MARKDOWN_IMAGE_PATTERN = Pattern.compile("!\\[([^\\]]*)]\\(([^\\s)]+)(?:\\s+[^)]*)?\\)");
    private static final Pattern MARKDOWN_LINK_PATTERN = Pattern.compile("(?<!!)\\[([^\\]]+)]\\(([^\\s)]+)(?:\\s+[^)]*)?\\)");

    @Value("${app.frontend.dist.path:/opt/myblog/dist}")
    private String frontendDistPath;

    @Value("${app.site.name:个人博客}")
    private String siteName;

    @Value("${app.site.author:博主}")
    private String siteAuthor;

    public String renderArticlePage(ArticleDto article, String canonicalUrl) {
        String title = safeTitle(article);
        String description = buildDescription(article.getContent());
        String articleHtml = buildArticleHtml(article);
        String indexHtml = readIndexHtml();

        String html = TITLE_PATTERN.matcher(indexHtml)
                .replaceFirst(Matcher.quoteReplacement("<title>" + escapeHtml(title + " - " + safeSiteName()) + "</title>"));
        html = DESCRIPTION_PATTERN.matcher(html)
                .replaceFirst(Matcher.quoteReplacement("<meta name=\"description\" content=\"" + escapeHtmlAttribute(description) + "\" />"));

        String headExtras = buildHeadExtras(article, title, description, canonicalUrl);
        html = html.replace("</head>", headExtras + "\n  </head>");

        String root = "<div id=\"root\">\n" + articleHtml + "\n    </div>";
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
                <link rel="canonical" href="%s" />
                <meta property="og:title" content="%s - %s" />
                <meta property="og:description" content="%s" />
                <meta property="og:type" content="article" />
                <meta property="og:url" content="%s" />
                <script type="application/ld+json">%s</script>
                """.formatted(
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
                renderMarkdown(article.getContent())
        );
    }

    private String renderMarkdown(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }

        StringBuilder html = new StringBuilder();
        StringBuilder paragraph = new StringBuilder();
        boolean inCodeBlock = false;
        StringBuilder code = new StringBuilder();

        for (String rawLine : markdown.replace("\r\n", "\n").split("\n")) {
            String line = rawLine.stripTrailing();
            if (line.startsWith("```") || line.startsWith("~~~")) {
                flushParagraph(html, paragraph);
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
                flushParagraph(html, paragraph);
                continue;
            }

            Matcher heading = Pattern.compile("^(#{1,6})\\s+(.+)$").matcher(line);
            if (heading.matches()) {
                flushParagraph(html, paragraph);
                int level = heading.group(1).length();
                html.append("<h").append(level).append(">")
                        .append(renderInlineMarkdown(heading.group(2)))
                        .append("</h").append(level).append(">\n");
                continue;
            }

            Matcher unordered = Pattern.compile("^[-*+]\\s+(.+)$").matcher(line);
            if (unordered.matches()) {
                flushParagraph(html, paragraph);
                html.append("<ul><li>").append(renderInlineMarkdown(unordered.group(1))).append("</li></ul>\n");
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
        flushParagraph(html, paragraph);
        return html.toString();
    }

    private void flushParagraph(StringBuilder html, StringBuilder paragraph) {
        if (paragraph.isEmpty()) {
            return;
        }
        html.append("<p>").append(renderInlineMarkdown(paragraph.toString())).append("</p>\n");
        paragraph.setLength(0);
    }

    private String renderInlineMarkdown(String text) {
        String escaped = escapeHtml(text);
        escaped = MARKDOWN_IMAGE_PATTERN.matcher(escaped)
                .replaceAll(match -> "<img src=\"" + escapeHtmlAttribute(match.group(2)) + "\" alt=\"" + escapeHtmlAttribute(match.group(1)) + "\" loading=\"lazy\" />");
        escaped = MARKDOWN_LINK_PATTERN.matcher(escaped)
                .replaceAll(match -> "<a href=\"" + escapeHtmlAttribute(match.group(2)) + "\">" + match.group(1) + "</a>");
        return escaped;
    }

    private String buildDescription(String content) {
        if (content == null || content.isBlank()) {
            return safeSiteName() + "文章";
        }
        String plain = content
                .replaceAll("(?s)<!--.*?-->", " ")
                .replaceAll("(?s)```.*?```", " ")
                .replaceAll("!\\[[^\\]]*]\\([^)]*\\)", " ")
                .replaceAll("\\[[^\\]]+]\\(([^)]*)\\)", " ")
                .replaceAll("[#>*_`~\\-]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (plain.isBlank()) {
            return safeSiteName() + "文章";
        }
        return plain.length() > 160 ? plain.substring(0, 160) : plain;
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
