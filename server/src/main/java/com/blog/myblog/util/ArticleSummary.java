package com.blog.myblog.util;

public final class ArticleSummary {
    private ArticleSummary() {
    }

    public static String fromMarkdown(String content) {
        if (content == null || content.isBlank()) {
            return "文章正文暂无可用摘要。";
        }
        String plain = content
                .replaceAll("(?s)<!--.*?-->", " ")
                .replaceAll("(?s)```.*?```|~~~.*?~~~", " ")
                .replaceAll("!\\[[^\\]]*]\\([^)]*\\)", " ")
                .replaceAll("\\[([^\\]]+)]\\([^)]*\\)", "$1")
                .replaceAll("<[^>]+>", " ")
                .replaceAll("[#>*_`~]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (plain.isBlank()) {
            return "文章正文暂无可用摘要。";
        }
        int length = plain.codePointCount(0, plain.length());
        return length > 160 ? plain.substring(0, plain.offsetByCodePoints(0, 160)) : plain;
    }
}
