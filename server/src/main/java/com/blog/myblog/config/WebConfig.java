package com.blog.myblog.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.image.storage.path}")
    private String imageStoragePath;

    @Value("${app.attachment.storage.path}")
    private String attachmentStoragePath;

    @Value("${app.docs.path}")
    private String docsPath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/images/**")
                .addResourceLocations("file:" + imageStoragePath + "/");
        registry.addResourceHandler("/static/attachments/**")
                .addResourceLocations("file:" + attachmentStoragePath + "/");
        registry.addResourceHandler("/docs-static/**")
                .addResourceLocations("file:" + docsPath + "/");
    }
}
