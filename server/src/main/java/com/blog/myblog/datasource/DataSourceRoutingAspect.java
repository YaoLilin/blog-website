package com.blog.myblog.datasource;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.aop.support.AopUtils;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;

@Aspect
@Component
public class DataSourceRoutingAspect {

    @Around("""
            execution(* com.blog.myblog..*(..)) &&
            (
                @within(org.springframework.stereotype.Service) ||
                @within(org.springframework.web.bind.annotation.RestController)
            )
            """)
    public Object route(ProceedingJoinPoint joinPoint) throws Throwable {
        DataSourceType dataSourceType = resolveDataSourceType(joinPoint);
        if (dataSourceType == null) {
            return joinPoint.proceed();
        }

        DataSourceContextHolder.push(dataSourceType);
        try {
            return joinPoint.proceed();
        } finally {
            DataSourceContextHolder.pop();
        }
    }

    private DataSourceType resolveDataSourceType(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method interfaceMethod = signature.getMethod();
        Class<?> targetClass = AopUtils.getTargetClass(joinPoint.getTarget());
        Method targetMethod = AopUtils.getMostSpecificMethod(interfaceMethod, targetClass);

        if (hasAnnotation(targetMethod, WriteDb.class) || hasAnnotation(targetClass, WriteDb.class)) {
            return DataSourceType.MASTER;
        }
        if (hasAnnotation(targetMethod, ReadDb.class) || hasAnnotation(targetClass, ReadDb.class)) {
            return DataSourceType.REPLICA;
        }
        return null;
    }

    private boolean hasAnnotation(Method method, Class<? extends Annotation> annotationType) {
        return AnnotatedElementUtils.hasAnnotation(method, annotationType);
    }

    private boolean hasAnnotation(Class<?> type, Class<? extends Annotation> annotationType) {
        return AnnotatedElementUtils.hasAnnotation(type, annotationType);
    }
}
