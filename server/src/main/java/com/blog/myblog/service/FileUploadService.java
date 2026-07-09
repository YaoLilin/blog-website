package com.blog.myblog.service;

import com.blog.myblog.datasource.WriteDb;
import com.blog.myblog.entity.Attachment;
import com.blog.myblog.entity.Image;
import com.blog.myblog.repository.AttachmentRepository;
import com.blog.myblog.repository.ImageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@WriteDb
@RequiredArgsConstructor
public class FileUploadService {

    @Value("${app.image.storage.path}")
    private String imageStoragePath;

    @Value("${app.attachment.storage.path}")
    private String attachmentStoragePath;

    private final ImageRepository imageRepository;
    private final AttachmentRepository attachmentRepository;

    public record UploadResult(String url, String originalName) {}

    public UploadResult upload(MultipartFile file, Long articleId) throws IOException {
        String contentType = file.getContentType();
        boolean isImage = contentType != null && contentType.startsWith("image/");

        LocalDateTime now = LocalDateTime.now();
        String datePath = String.format("%d/%02d", now.getYear(), now.getMonthValue());
        String ext = getExtension(file.getOriginalFilename());
        String newName = UUID.randomUUID() + ext;

        if (isImage) {
            return saveImage(file, datePath, newName, articleId);
        } else {
            return saveAttachment(file, datePath, newName, articleId);
        }
    }

    private UploadResult saveImage(MultipartFile file, String datePath, String newName, Long articleId) throws IOException {
        File dir = new File(imageStoragePath + "/" + datePath);
        dir.mkdirs();
        File dest = new File(dir, newName);
        file.transferTo(dest);

        Image image = new Image();
        image.setArticleId(articleId);
        image.setOriginalName(file.getOriginalFilename());
        image.setFilePath(dest.getAbsolutePath());
        image.setFileSize(file.getSize());
        image.setMimeType(file.getContentType());
        imageRepository.save(image);

        return new UploadResult("/api/static/images/" + datePath + "/" + newName, file.getOriginalFilename());
    }

    private UploadResult saveAttachment(MultipartFile file, String datePath, String newName, Long articleId) throws IOException {
        File dir = new File(attachmentStoragePath + "/" + datePath);
        dir.mkdirs();
        File dest = new File(dir, newName);
        file.transferTo(dest);

        if (articleId != null) {
            Attachment attachment = new Attachment();
            attachment.setArticleId(articleId);
            attachment.setOriginalName(file.getOriginalFilename());
            attachment.setFilePath(dest.getAbsolutePath());
            attachment.setFileSize(file.getSize());
            attachment.setMimeType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
            attachmentRepository.save(attachment);
        }

        return new UploadResult("/api/static/attachments/" + datePath + "/" + newName, file.getOriginalFilename());
    }

    private String getExtension(String filename) {
        if (filename == null) return "";
        int idx = filename.lastIndexOf('.');
        return idx >= 0 ? filename.substring(idx) : "";
    }
}
