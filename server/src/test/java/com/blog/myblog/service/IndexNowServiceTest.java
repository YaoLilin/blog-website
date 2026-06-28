package com.blog.myblog.service;

import com.blog.myblog.repository.ArticleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IndexNowServiceTest {

    @TempDir
    private Path tempDir;

    @Test
    void syncKeyFileWritesKeyToFrontendDistRoot() throws Exception {
        IndexNowService service = new IndexNowService(emptyArticleRepository(), new ObjectMapper());
        ReflectionTestUtils.setField(service, "frontendDistPath", tempDir.toString());
        ReflectionTestUtils.setField(service, "siteBaseUrl", "https://yaolilin.com");
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "key", "abc123");
        ReflectionTestUtils.setField(service, "endpoint", "https://www.bing.com/indexnow");

        service.syncKeyFile();

        Path keyFile = tempDir.resolve("abc123.txt");
        assertTrue(Files.exists(keyFile));
        assertEquals("abc123", Files.readString(keyFile));
    }

    private static ArticleRepository emptyArticleRepository() {
        return (ArticleRepository) Proxy.newProxyInstance(
                ArticleRepository.class.getClassLoader(),
                new Class<?>[]{ArticleRepository.class},
                (proxy, method, args) -> {
                    if (method.getReturnType() == Optional.class) {
                        return Optional.empty();
                    }
                    if (!method.getReturnType().isPrimitive()) {
                        return null;
                    }
                    if (method.getReturnType() == boolean.class) {
                        return false;
                    }
                    return 0;
                }
        );
    }
}
