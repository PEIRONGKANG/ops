package com.beverageops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.beverageops.identityaccess.application.usecase.IdentityAccessProperties;

@SpringBootApplication
@EnableConfigurationProperties(IdentityAccessProperties.class)
public class BootstrapApplication {

    public static void main(String[] args) {
        SpringApplication.run(BootstrapApplication.class, args);
    }
}
