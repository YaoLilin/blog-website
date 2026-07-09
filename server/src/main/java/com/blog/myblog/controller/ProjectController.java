package com.blog.myblog.controller;

import com.blog.myblog.datasource.ReadDb;
import com.blog.myblog.datasource.WriteDb;
import com.blog.myblog.dto.ProjectDto;
import com.blog.myblog.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/projects")
@ReadDb
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public List<ProjectDto> getAll() {
        return projectService.getAll();
    }

    @GetMapping("/{id}")
    public ProjectDto getById(@PathVariable Long id) {
        return projectService.getById(id);
    }

    @PostMapping
    @WriteDb
    public ProjectDto create(@RequestBody ProjectDto dto) {
        return projectService.create(dto);
    }

    @PutMapping("/{id}")
    @WriteDb
    public ProjectDto update(@PathVariable Long id, @RequestBody ProjectDto dto) {
        return projectService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @WriteDb
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        projectService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
