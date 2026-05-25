package com.blog.myblog.dto;

import lombok.Data;

@Data
public class ProjectDto {
    private Long id;
    private String name;
    private String shortDesc;
    private String description;
    private String link;
    private String coverImage;
    private Integer sortOrder;
}
