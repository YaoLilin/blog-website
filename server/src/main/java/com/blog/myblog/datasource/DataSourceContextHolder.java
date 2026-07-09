package com.blog.myblog.datasource;

import java.util.ArrayDeque;
import java.util.Deque;

public final class DataSourceContextHolder {

    private static final ThreadLocal<Deque<DataSourceType>> CONTEXT =
            ThreadLocal.withInitial(ArrayDeque::new);

    private DataSourceContextHolder() {
    }

    public static void push(DataSourceType dataSourceType) {
        CONTEXT.get().push(dataSourceType);
    }

    public static DataSourceType peek() {
        Deque<DataSourceType> deque = CONTEXT.get();
        return deque.isEmpty() ? null : deque.peek();
    }

    public static void pop() {
        Deque<DataSourceType> deque = CONTEXT.get();
        if (!deque.isEmpty()) {
            deque.pop();
        }
        if (deque.isEmpty()) {
            CONTEXT.remove();
        }
    }
}
