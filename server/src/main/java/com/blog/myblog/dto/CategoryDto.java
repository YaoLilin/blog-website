package com.blog.myblog.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CategoryDto {
    private Long id;
    private String name;
    private String filePath;
    private Long parentId;
    private String coverImage;
    private Integer sortOrder;
    private Boolean isServerManaged;
    private Boolean hasGitRepo;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<CategoryDto> children;
}
