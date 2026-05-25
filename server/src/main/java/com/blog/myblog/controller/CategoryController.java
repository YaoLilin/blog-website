package com.blog.myblog.controller;

import com.blog.myblog.dto.CategoryDto;
import com.blog.myblog.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

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
    public CategoryDto create(@RequestBody CategoryDto dto) {
        return categoryService.create(dto);
    }

    @PutMapping("/{id}")
    public CategoryDto update(@PathVariable Long id, @RequestBody CategoryDto dto) {
        return categoryService.update(id, dto);
    }

    @GetMapping("/{id}")
    public CategoryDto getById(@PathVariable Long id) {
        return categoryService.getById(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/move")
    public ResponseEntity<Void> move(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long newParentId = body.get("newParentId") != null ? Long.valueOf(body.get("newParentId").toString()) : null;
        categoryService.move(id, newParentId);
        return ResponseEntity.ok().build();
    }
}
