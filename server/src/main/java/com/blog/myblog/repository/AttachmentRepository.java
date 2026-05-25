package com.blog.myblog.repository;

import com.blog.myblog.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByArticleId(Long articleId);
}
