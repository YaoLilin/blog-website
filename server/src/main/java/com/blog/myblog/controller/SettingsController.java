package com.blog.myblog.controller;

import com.blog.myblog.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SystemSettingService systemSettingService;

    @GetMapping("/motto")
    public Map<String, String> getMotto() {
        return Map.of("motto", systemSettingService.get("MOTTO", "我们得为人类做点什么"));
    }

    @PutMapping("/motto")
    public ResponseEntity<Void> updateMotto(@RequestBody Map<String, String> body) {
        systemSettingService.set("MOTTO", body.getOrDefault("motto", ""));
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public Map<String, String> getAll() {
        return systemSettingService.getAll();
    }

    @PutMapping("/{key}")
    public ResponseEntity<Void> update(@PathVariable String key, @RequestBody Map<String, String> body) {
        systemSettingService.set(key, body.getOrDefault("value", ""));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/profile")
    public Map<String, String> getProfile() {
        return Map.of(
                "image", systemSettingService.get("PROFILE_IMAGE", ""),
                "content", systemSettingService.get("PROFILE_CONTENT", ""),
                "motto", systemSettingService.get("MOTTO", "我们得为人类做点什么")
        );
    }

    @PutMapping("/profile")
    public ResponseEntity<Void> updateProfile(@RequestBody Map<String, String> body) {
        if (body.containsKey("image")) {
            systemSettingService.set("PROFILE_IMAGE", body.get("image"));
        }
        if (body.containsKey("content")) {
            systemSettingService.set("PROFILE_CONTENT", body.get("content"));
        }
        return ResponseEntity.ok().build();
    }
}
