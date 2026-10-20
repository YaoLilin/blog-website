package com.blog.myblog.dto;

import java.util.List;

public record HomeSeoDto(List<CategoryDto> categories, List<ArticleDto> recommendedArticles,
                         List<ArticleDto> recentArticles) {
}
