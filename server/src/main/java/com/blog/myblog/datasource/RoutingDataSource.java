package com.blog.myblog.datasource;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class RoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        DataSourceType current = DataSourceContextHolder.peek();
        return current == null ? DataSourceType.MASTER : current;
    }
}
