package com.blog.myblog.service;

import com.blog.myblog.datasource.ReadDb;
import com.blog.myblog.datasource.WriteDb;
import com.blog.myblog.entity.SystemSetting;
import com.blog.myblog.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.stream.Collectors;

@Service
@ReadDb
@RequiredArgsConstructor
public class SystemSettingService {

    private final SystemSettingRepository systemSettingRepository;

    public String get(String key, String defaultValue) {
        return systemSettingRepository.findBySettingKey(key)
                .map(SystemSetting::getSettingValue)
                .orElse(defaultValue);
    }

    @Transactional
    @WriteDb
    public void set(String key, String value) {
        SystemSetting setting = systemSettingRepository.findBySettingKey(key).orElseGet(() -> {
            SystemSetting s = new SystemSetting();
            s.setSettingKey(key);
            s.setSettingType("STRING");
            return s;
        });
        setting.setSettingValue(value);
        systemSettingRepository.save(setting);
    }

    public Map<String, String> getAll() {
        return systemSettingRepository.findAll().stream()
                .collect(Collectors.toMap(SystemSetting::getSettingKey,
                        s -> s.getSettingValue() != null ? s.getSettingValue() : ""));
    }
}
