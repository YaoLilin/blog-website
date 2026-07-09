package com.blog.myblog.config;

import com.blog.myblog.datasource.DataSourceType;
import com.blog.myblog.datasource.RoutingDataSource;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;
import org.springframework.util.StringUtils;

import java.util.Map;
import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

    @Bean
    @ConfigurationProperties("app.datasource.master")
    public DataSourceProperties masterDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("app.datasource.replica")
    public DataSourceProperties replicaDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    public DataSource masterDataSource() {
        return masterDataSourceProperties()
                .initializeDataSourceBuilder()
                .build();
    }

    @Bean
    public DataSource replicaDataSource() {
        DataSourceProperties replica = replicaDataSourceProperties();
        if (!StringUtils.hasText(replica.getUrl())) {
            return masterDataSource();
        }
        return replica.initializeDataSourceBuilder().build();
    }

    @Bean
    @Primary
    public DataSource dataSource() {
        RoutingDataSource routingDataSource = new RoutingDataSource();
        routingDataSource.setTargetDataSources(Map.of(
                DataSourceType.MASTER, masterDataSource(),
                DataSourceType.REPLICA, replicaDataSource()
        ));
        routingDataSource.setDefaultTargetDataSource(masterDataSource());
        routingDataSource.afterPropertiesSet();
        return new LazyConnectionDataSourceProxy(routingDataSource);
    }
}
