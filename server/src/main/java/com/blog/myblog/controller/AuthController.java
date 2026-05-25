package com.blog.myblog.controller;

import com.blog.myblog.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.password}")
    private String adminPassword;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String password = body.get("password");
        if (password == null || !passwordEncoder.matches(password, adminPassword)) {
            return ResponseEntity.status(401).body(Map.of("message", "密码错误"));
        }
        String token = jwtUtil.generateToken();
        return ResponseEntity.ok(Map.of("token", token));
    }
}
