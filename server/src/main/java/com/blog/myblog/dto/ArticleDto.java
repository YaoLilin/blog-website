package com.blog.myblog.dto;

import lombok.Data;
import com.blog.myblog.util.ArticleSummary;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class ArticleDto {
    private Long id;
    private String title;
    private String content;
    private Long categoryId;
    private String filePath;
    private CategoryDto category;
    private Integer viewCount;
    private Boolean isRecommended;
    private Boolean isServerManaged;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public String getDescription() {
        return ArticleSummary.fromMarkdown(content);
    }

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public String getSeoTitle() {
        List<String> parts = new ArrayList<>();
        if (category != null) {
            if (category.getFilePath() != null && !category.getFilePath().isBlank()) {
                for (String segment : category.getFilePath().split("/")) {
                    if (!segment.isBlank()) {
                        parts.add(segment.trim());
                    }
                }
            } else if (category.getName() != null && !category.getName().isBlank()) {
                parts.add(category.getName().trim());
            }
        }
        String articleTitle = title == null || title.isBlank() ? "文章" : title.trim();
        if (parts.isEmpty() || !articleTitle.equals(parts.get(parts.size() - 1))) {
            parts.add(articleTitle);
        }
        return String.join(" > ", parts);
    }
}
