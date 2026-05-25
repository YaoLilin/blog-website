package com.blog.myblog.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "site_visit_record")
@Data
public class SiteVisitRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "visit_date", nullable = false)
    private java.time.LocalDate visitDate;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        visitDate = java.time.LocalDate.now();
        createdAt = LocalDateTime.now();
    }
}
