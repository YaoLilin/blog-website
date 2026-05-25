package com.blog.myblog.service;

import com.blog.myblog.entity.HelpfulVote;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.HelpfulVoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HelpfulVoteService {

    private final HelpfulVoteRepository helpfulVoteRepository;
    private final ArticleRepository articleRepository;

    public boolean isVoted(Long articleId, String fingerprint) {
        return helpfulVoteRepository.existsByArticleIdAndFingerprint(articleId, fingerprint);
    }

    @Transactional
    public boolean vote(Long articleId, String fingerprint) {
        if (isVoted(articleId, fingerprint)) {
            return false;
        }
        HelpfulVote vote = new HelpfulVote();
        vote.setArticleId(articleId);
        vote.setFingerprint(fingerprint);
        helpfulVoteRepository.save(vote);

        articleRepository.findById(articleId).ifPresent(a -> {
            a.setHelpfulCount(a.getHelpfulCount() == null ? 1 : a.getHelpfulCount() + 1);
            articleRepository.save(a);
        });
        return true;
    }

    public List<Map<String, Object>> getTopHelpful(int limit) {
        List<Object[]> raw = helpfulVoteRepository.findTopHelpfulGrouped();
        List<Map<String, Object>> all = new ArrayList<>();
        for (Object[] row : raw) {
            Long articleId = (Long) row[0];
            Long voteCount = (Long) row[1];
            articleRepository.findById(articleId).ifPresent(a -> {
                int views = a.getViewCount() == null ? 0 : a.getViewCount();
                double ratio = views > 0 ? (double) voteCount / views : 0;
                Map<String, Object> item = new java.util.HashMap<>();
                item.put("articleId", a.getId());
                item.put("title", a.getTitle());
                item.put("helpfulCount", voteCount.intValue());
                item.put("viewCount", views);
                item.put("ratio", Math.round(ratio * 10000) / 100.0);
                all.add(item);
            });
        }
        all.sort((a, b) -> Double.compare((Double) b.get("ratio"), (Double) a.get("ratio")));
        return all.size() > limit ? all.subList(0, limit) : all;
    }
}
