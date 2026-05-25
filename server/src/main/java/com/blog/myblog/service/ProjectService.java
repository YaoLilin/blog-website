package com.blog.myblog.service;

import com.blog.myblog.dto.ProjectDto;
import com.blog.myblog.entity.Project;
import com.blog.myblog.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

    public List<ProjectDto> getAll() {
        return projectRepository.findAllByOrderBySortOrderAsc().stream()
                .map(this::toDto).collect(Collectors.toList());
    }

    public ProjectDto getById(Long id) {
        return projectRepository.findById(id).map(this::toDto).orElseThrow();
    }

    @Transactional
    public ProjectDto create(ProjectDto dto) {
        Project p = new Project();
        p.setName(dto.getName());
        p.setShortDesc(dto.getShortDesc());
        p.setDescription(dto.getDescription());
        p.setLink(dto.getLink());
        p.setCoverImage(dto.getCoverImage());
        p.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        return toDto(projectRepository.save(p));
    }

    @Transactional
    public ProjectDto update(Long id, ProjectDto dto) {
        Project p = projectRepository.findById(id).orElseThrow();
        if (dto.getName() != null) p.setName(dto.getName());
        if (dto.getShortDesc() != null) p.setShortDesc(dto.getShortDesc());
        if (dto.getDescription() != null) p.setDescription(dto.getDescription());
        if (dto.getLink() != null) p.setLink(dto.getLink());
        if (dto.getCoverImage() != null) p.setCoverImage(dto.getCoverImage());
        if (dto.getSortOrder() != null) p.setSortOrder(dto.getSortOrder());
        return toDto(projectRepository.save(p));
    }

    @Transactional
    public void delete(Long id) {
        projectRepository.deleteById(id);
    }

    public ProjectDto toDto(Project p) {
        ProjectDto dto = new ProjectDto();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setShortDesc(p.getShortDesc());
        dto.setDescription(p.getDescription());
        dto.setLink(p.getLink());
        dto.setCoverImage(p.getCoverImage());
        dto.setSortOrder(p.getSortOrder());
        return dto;
    }
}
