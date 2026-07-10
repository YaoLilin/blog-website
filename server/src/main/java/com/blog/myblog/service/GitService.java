package com.blog.myblog.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.MergeResult;
import org.eclipse.jgit.api.PullCommand;
import org.eclipse.jgit.api.PullResult;
import org.eclipse.jgit.api.PushCommand;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.errors.CheckoutConflictException;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@Service
@Slf4j
@RequiredArgsConstructor
public class GitService {
    private static final String DEBUG_PREFIX = "[DEBUG-gitpull-20260709]";

    @Value("${app.docs.path}")
    private String docsPath;

    private final FileWatcherService fileWatcherService;
    private final IndexNowService indexNowService;

    private Git openRepo(String repoRelativePath) throws IOException {
        Path gitDir = locateGitDir(repoRelativePath);
        if (gitDir == null) {
            throw new IOException("Git repository not found");
        }
        FileRepositoryBuilder builder = new FileRepositoryBuilder();
        Repository repo = builder.setGitDir(gitDir.toFile())
                .readEnvironment()
                .setMustExist(true)
                .build();
        return new Git(repo);
    }

    private Path locateGitDir(String repoRelativePath) {
        Path docsRoot = Path.of(docsPath).toAbsolutePath().normalize();
        Path root = repoRelativePath == null || repoRelativePath.isBlank()
                ? docsRoot
                : docsRoot.resolve(repoRelativePath).normalize();

        if (!root.startsWith(docsRoot)) {
            return null;
        }

        Path current = root;
        while (current != null && current.startsWith(docsRoot)) {
            Path gitDir = current.resolve(".git");
            if (Files.exists(gitDir)) {
                return gitDir;
            }
            current = current.getParent();
        }
        return null;
    }

    public Map<String, Object> getStatus(String repoRelativePath) {
        Map<String, Object> result = new HashMap<>();
        try {
            Git git = openRepo(repoRelativePath);
            result.put("hasRepo", true);
            result.put("currentBranch", git.getRepository().getBranch());
            var status = git.status().call();
            boolean hasChanges = !status.isClean();
            result.put("hasUncommittedChanges", hasChanges);
            List<String> files = new ArrayList<>();
            files.addAll(status.getModified());
            files.addAll(status.getUntracked());
            files.addAll(status.getAdded());
            files.addAll(status.getRemoved());
            result.put("uncommittedFiles", files);
            var remoteNames = git.getRepository().getRemoteNames();
            result.put("remoteUrls", new ArrayList<>(remoteNames));
            git.close();
        } catch (Exception e) {
            result.put("hasRepo", false);
        }
        return result;
    }

    public void commit(String message, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            git.add().addFilepattern(".").call();
            git.commit().setMessage(message).call();
        }
    }

    public void push(String remoteName, String username, String password, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            PushCommand command = git.push().setRemote(remoteName);
            CredentialsProvider cp = createCredentialsProvider(username, password);
            if (cp != null) {
                command.setCredentialsProvider(cp);
            }
            command.call();
        }
    }

    public Map<String, Object> pull(String remoteName, String username, String password, String repoRelativePath, boolean forceOverwrite) throws IOException, GitAPIException {
        Map<String, Object> result = new HashMap<>();
        String opId = Long.toHexString(System.nanoTime());
        long startedAt = System.nanoTime();
        log.info("{} op={} pull start repoRelativePath={} remoteName={} forceOverwrite={}",
                DEBUG_PREFIX, opId, repoRelativePath, remoteName, forceOverwrite);
        try (Git git = openRepo(repoRelativePath)) {
            if (forceOverwrite) {
                long discardStartedAt = System.nanoTime();
                discardLocalChanges(git);
                log.info("{} op={} discardLocalChanges finished in {} ms",
                        DEBUG_PREFIX, opId, elapsedMillis(discardStartedAt));
            }
            long pullStartedAt = System.nanoTime();
            PullResult pullResult = createPullCommand(git, remoteName, username, password).call();
            log.info("{} op={} jgit pull finished in {} ms",
                    DEBUG_PREFIX, opId, elapsedMillis(pullStartedAt));
            result.put("success", pullResult.isSuccessful());
            result.put("hasConflicts", hasPullConflicts(pullResult));
            if (pullResult.isSuccessful()) {
                long syncStartedAt = System.nanoTime();
                List<Long> changedArticleIds = fileWatcherService == null
                        ? List.of()
                        : fileWatcherService.syncPathAndCollectChangedArticles(repoRelativePath);
                log.info("{} op={} docs sync finished in {} ms, changedArticles={}",
                        DEBUG_PREFIX, opId, elapsedMillis(syncStartedAt), changedArticleIds.size());
                if (indexNowService != null && !changedArticleIds.isEmpty()) {
                    indexNowService.submitArticles(changedArticleIds);
                }
            }
            log.info("{} op={} pull result success={} hasConflicts={}",
                    DEBUG_PREFIX, opId, pullResult.isSuccessful(), hasPullConflicts(pullResult));
        } catch (CheckoutConflictException e) {
            log.warn("{} op={} checkout conflict after {} ms: {}",
                    DEBUG_PREFIX, opId, elapsedMillis(startedAt), e.getMessage());
            throw toPullConflictException(e);
        } catch (Exception e) {
            log.warn("{} op={} pull failed after {} ms: {}",
                    DEBUG_PREFIX, opId, elapsedMillis(startedAt), e.getMessage(), e);
            GitPullConflictException conflict = toPullConflictExceptionOrNull(e);
            if (conflict != null) {
                throw conflict;
            }
            throw e;
        }
        log.info("{} op={} pull finished in {} ms",
                DEBUG_PREFIX, opId, elapsedMillis(startedAt));
        return result;
    }

    private long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }

    private PullCommand createPullCommand(Git git, String remoteName, String username, String password) {
        PullCommand command = git.pull().setRemote(remoteName);
        CredentialsProvider cp = createCredentialsProvider(username, password);
        if (cp != null) {
            command.setCredentialsProvider(cp);
        }
        return command;
    }

    private boolean hasPullConflicts(PullResult pullResult) {
        MergeResult mergeResult = pullResult.getMergeResult();
        return mergeResult != null && !mergeResult.getMergeStatus().isSuccessful();
    }

    private void discardLocalChanges(Git git) throws GitAPIException {
        git.reset().setMode(ResetCommand.ResetType.HARD).call();
        git.clean().setCleanDirectories(false).setForce(true).call();
    }

    static List<String> extractConflictFiles(String message) {
        if (message == null || message.isBlank()) {
            return List.of();
        }
        String prefix = "Checkout conflict with files:";
        if (!message.startsWith(prefix)) {
            return List.of();
        }
        return Arrays.stream(message.substring(prefix.length()).split("\\R"))
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .toList();
    }

    public static GitPullConflictException toPullConflictException(Exception exception) {
        GitPullConflictException conflict = toPullConflictExceptionOrNull(exception);
        if (conflict != null) {
            return conflict;
        }
        return new GitPullConflictException(List.of());
    }

    public static GitPullConflictException toPullConflictExceptionOrNull(Exception exception) {
        if (exception == null) {
            return null;
        }
        List<String> files = extractConflictFiles(exception.getMessage());
        if (files.isEmpty()) {
            return null;
        }
        return new GitPullConflictException(files);
    }

    private CredentialsProvider createCredentialsProvider(String username, String password) {
        boolean hasUsername = username != null && !username.isBlank();
        boolean hasPassword = password != null && !password.isBlank();
        if (!hasUsername && !hasPassword) {
            return null;
        }
        return new UsernamePasswordCredentialsProvider(
                username == null ? "" : username,
                password == null ? "" : password
        );
    }

    public void addRemote(String name, String url, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            git.remoteAdd().setName(name).setUri(new org.eclipse.jgit.transport.URIish(url)).call();
        } catch (Exception e) {
            throw new GitAPIException("Invalid URL: " + url + " - " + e.getMessage()) {};
        }
    }

    public void removeRemote(String name, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            git.remoteRemove().setRemoteName(name).call();
        }
    }

    public List<Map<String, Object>> listRemotes(String repoRelativePath) throws IOException {
        List<Map<String, Object>> remotes = new ArrayList<>();
        try (Git git = openRepo(repoRelativePath)) {
            var configs = git.getRepository().getConfig();
            var remoteNames = git.getRepository().getRemoteNames();
            for (String name : remoteNames) {
                Map<String, Object> r = new HashMap<>();
                r.put("name", name);
                r.put("urls", List.of(configs.getString("remote", name, "url")));
                remotes.add(r);
            }
        }
        return remotes;
    }

    public void initRepo() throws GitAPIException {
        File dir = new File(docsPath);
        dir.mkdirs();
        try (Git git = Git.init().setDirectory(dir).call()) {
            git.add().addFilepattern(".").call();
            git.commit().setMessage("Initial commit").call();
        }
    }

    /**
     * 校验用户输入的自定义路径，拒绝绝对路径和路径穿越。
     * @return 标准化后的相对路径
     */
    public String validateCustomPath(String customPath) {
        if (customPath == null || customPath.isBlank()) {
            return null;
        }
        String normalized = customPath.replace("\\", "/").trim();
        if (normalized.startsWith("/")) {
            throw new IllegalArgumentException("自定义路径不能为绝对路径");
        }
        Path docsRoot = Path.of(docsPath).toAbsolutePath().normalize();
        Path resolved = docsRoot.resolve(normalized).normalize();
        if (!resolved.startsWith(docsRoot)) {
            throw new IllegalArgumentException("自定义路径不能超出文档目录");
        }
        return normalized;
    }

    public Map<String, Object> cloneRemoteRepo(String url, String targetRelativePath) throws IOException, GitAPIException {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("仓库地址不能为空");
        }
        Path targetDir = resolveCloneTarget(targetRelativePath);
        if (Files.exists(targetDir) && Files.isDirectory(targetDir)) {
            try (Stream<Path> stream = Files.list(targetDir)) {
                if (stream.findAny().isPresent()) {
                    throw new IllegalArgumentException("目标目录已存在且非空");
                }
            }
        } else if (Files.exists(targetDir)) {
            throw new IllegalArgumentException("目标目录已存在且非空");
        }
        Files.createDirectories(targetDir.getParent() != null ? targetDir.getParent() : targetDir);
        cloneToDirectory(url, targetDir);
        if (!targetDir.toAbsolutePath().normalize().equals(Path.of(docsPath).toAbsolutePath().normalize())) {
            fileWatcherService.registerDirectoryTree(targetDir);
        }
        fileWatcherService.rescan();

        Map<String, Object> result = new HashMap<>();
        result.put("directory", targetDir.toString());
        result.put("repoName", targetDir.getFileName() != null ? targetDir.getFileName().toString() : "");
        result.put("relativePath", relativePathFromDocs(targetDir));
        return result;
    }

    private void cloneToDirectory(String url, Path targetDir) throws IOException, GitAPIException {
        try {
            try (Git git = Git.cloneRepository()
                    .setURI(url)
                    .setDirectory(targetDir.toFile())
                    .call()) {
                git.getRepository().getBranch();
            }
        } catch (org.eclipse.jgit.api.errors.InvalidRemoteException e) {
            throw new IllegalArgumentException("仓库地址无效");
        }
    }

    private Path resolveCloneTarget(String relativePath) {
        Path base = Path.of(docsPath);
        return relativePath == null || relativePath.isBlank()
                ? base
                : base.resolve(relativePath);
    }

    private String relativePathFromDocs(Path path) {
        Path docsRoot = Path.of(docsPath).toAbsolutePath().normalize();
        Path normalized = path.toAbsolutePath().normalize();
        if (normalized.startsWith(docsRoot)) {
            return docsRoot.relativize(normalized).toString().replace('\\', '/');
        }
        return normalized.toString();
    }

    public static class GitPullConflictException extends RuntimeException {
        private final List<String> conflictFiles;

        public GitPullConflictException(List<String> conflictFiles) {
            super("拉取更新前检测到本地冲突文件");
            this.conflictFiles = List.copyOf(conflictFiles);
        }

        public List<String> getConflictFiles() {
            return conflictFiles;
        }
    }
}
