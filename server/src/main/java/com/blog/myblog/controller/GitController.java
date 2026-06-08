package com.blog.myblog.controller;

import com.blog.myblog.service.GitService;
import com.blog.myblog.service.CategoryService;
import com.blog.myblog.dto.CategoryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/git")
@RequiredArgsConstructor
public class GitController {

    private static final String ERROR = "error";
    private static final String CATEGORY_ID = "categoryId";

    private final GitService gitService;
    private final CategoryService categoryService;

    @GetMapping("/status")
    public Map<String, Object> getStatus(@RequestParam(required = false) Long categoryId) {
        return gitService.getStatus(resolveRepoRelativePath(categoryId));
    }

    @PostMapping("/commit")
    public ResponseEntity<Object> commit(@RequestBody Map<String, String> body) {
        try {
            gitService.commit(body.getOrDefault("message", "update"), resolveRepoRelativePath(parseCategoryId(body.get(CATEGORY_ID))));
            return ResponseEntity.ok((Object) null);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorBody(e));
        }
    }

    @PostMapping("/push")
    public ResponseEntity<Object> push(@RequestBody Map<String, String> body) {
        try {
            gitService.push(
                body.getOrDefault("remoteName", "origin"),
                body.getOrDefault("username", ""),
                body.getOrDefault("password", ""),
                resolveRepoRelativePath(parseCategoryId(body.get(CATEGORY_ID)))
            );
            return ResponseEntity.ok((Object) null);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorBody(e));
        }
    }

    @PostMapping("/pull")
    public ResponseEntity<Map<String, Object>> pull(@RequestBody Map<String, String> body) {
        try {
            Map<String, Object> result = gitService.pull(
                body.getOrDefault("remoteName", "origin"),
                body.getOrDefault("username", ""),
                body.getOrDefault("password", ""),
                resolveRepoRelativePath(parseCategoryId(body.get(CATEGORY_ID)))
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(ERROR, errorMessage(e)));
        }
    }

    @PostMapping("/remote/add")
    public ResponseEntity<Object> addRemote(@RequestBody Map<String, String> body) {
        try {
            gitService.addRemote(body.get("name"), body.get("url"), resolveRepoRelativePath(parseCategoryId(body.get(CATEGORY_ID))));
            return ResponseEntity.ok((Object) null);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorBody(e));
        }
    }

    @DeleteMapping("/remote/{name}")
    public ResponseEntity<Object> removeRemote(@PathVariable String name, @RequestParam(required = false) Long categoryId) {
        try {
            gitService.removeRemote(name, resolveRepoRelativePath(categoryId));
            return ResponseEntity.ok((Object) null);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(errorBody(e));
        }
    }

    @GetMapping("/remotes")
    public ResponseEntity<List<Map<String, Object>>> listRemotes(@RequestParam(required = false) Long categoryId) {
        try {
            List<Map<String, Object>> remotes = gitService.listRemotes(resolveRepoRelativePath(categoryId));
            return ResponseEntity.ok(remotes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(List.<Map<String, Object>>of());
        }
    }

    @PostMapping("/clone")
    public ResponseEntity<Map<String, Object>> cloneRepo(@RequestBody Map<String, Object> body) {
        try {
            String url = body.getOrDefault("url", "").toString();
            String customPath = body.get("customPath") != null ? body.get("customPath").toString().trim() : null;

            String targetRelativePath;
            if (customPath != null && !customPath.isBlank()) {
                targetRelativePath = gitService.validateCustomPath(customPath);
            } else {
                Long targetCategoryId = parseCategoryId(body.get("targetCategoryId"));
                targetRelativePath = resolveRepoRelativePath(targetCategoryId);
            }

            Map<String, Object> result = gitService.cloneRemoteRepo(url, targetRelativePath);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new java.util.HashMap<>();
            error.put(ERROR, errorMessage(e));
            return ResponseEntity.badRequest().body(error);
        }
    }

    private Long parseCategoryId(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        return Long.valueOf(value.toString());
    }

    private String resolveRepoRelativePath(Long categoryId) {
        if (categoryId == null) return null;
        CategoryDto target = categoryService.getById(categoryId);
        if (!Boolean.TRUE.equals(target.getIsServerManaged())) {
            throw new IllegalArgumentException("只能选择服务器管理分类");
        }
        return target.getFilePath();
    }

    private Object errorBody(Exception e) {
        return Map.of(ERROR, errorMessage(e));
    }

    private String errorMessage(Exception e) {
        return (e.getMessage() == null || e.getMessage().isBlank()) ? "操作失败" : e.getMessage();
    }
}
