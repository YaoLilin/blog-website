package com.blog.myblog.controller;

import com.blog.myblog.datasource.ReadDb;
import com.blog.myblog.datasource.WriteDb;
import com.blog.myblog.dto.CategoryDto;
import com.blog.myblog.service.CategoryService;
import com.blog.myblog.service.FileWatcherService;
import com.blog.myblog.service.IndexNowService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/categories")
@ReadDb
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;
    private final FileWatcherService fileWatcherService;
    private final IndexNowService indexNowService;

    @GetMapping
    public List<CategoryDto> getAll() {
        return categoryService.getAll();
    }

    @GetMapping("/tree")
    public List<CategoryDto> getTree() {
        return categoryService.getTree();
    }

    @GetMapping("/home")
    public List<CategoryDto> getHomeCategories() {
        return categoryService.getHomeCategories();
    }

    @PostMapping
    @WriteDb
    public CategoryDto create(@RequestBody CategoryDto dto) {
        return categoryService.create(dto);
    }

    @PutMapping("/{id}")
    @WriteDb
    public CategoryDto update(@PathVariable Long id, @RequestBody CategoryDto dto) {
        return categoryService.update(id, dto);
    }

    @GetMapping("/{id}")
    public CategoryDto getById(@PathVariable Long id) {
        return categoryService.getById(id);
    }

    @DeleteMapping("/{id}")
    @WriteDb
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/move")
    @WriteDb
    public ResponseEntity<Void> move(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long newParentId = body.get("newParentId") != null ? Long.valueOf(body.get("newParentId").toString()) : null;
        categoryService.move(id, newParentId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/sync")
    @WriteDb
    public ResponseEntity<Void> sync() {
        fileWatcherService.fullSync();
        indexNowService.submitAllArticles();
        return ResponseEntity.ok().build();
    }
}
