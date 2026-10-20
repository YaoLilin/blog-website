package com.blog.myblog.controller;

import com.blog.myblog.datasource.ReadDb;
import com.blog.myblog.dto.HomeSeoDto;
import com.blog.myblog.service.ArticleService;
import com.blog.myblog.service.CategoryService;
import com.blog.myblog.service.SeoHtmlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@ReadDb
@RequiredArgsConstructor
public class SeoHomeController {
    private final ArticleService articleService;
    private final CategoryService categoryService;
    private final SeoHtmlService seoHtmlService;

    @GetMapping(value = "/seo/home", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> home() {
        HomeSeoDto home = new HomeSeoDto(categoryService.getHomeCategories(),
                articleService.getRecommended(), articleService.getRecent(10));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES))
                .contentType(MediaType.TEXT_HTML)
                .body(seoHtmlService.renderHomePage(home));
    }
}
