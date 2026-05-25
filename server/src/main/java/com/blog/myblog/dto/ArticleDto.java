package com.blog.myblog.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ArticleDto {
    private Long id;
    private String title;
    private String content;
    private Long categoryId;
    private String filePath;
    private CategoryDto category;
    private Integer viewCount;
    private Integer helpfulCount;
    private Boolean isRecommended;
    private Boolean isServerManaged;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
