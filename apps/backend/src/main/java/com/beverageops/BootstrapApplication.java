package com.beverageops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.beverageops.identityaccess.application.usecase.IdentityAccessProperties;
import com.beverageops.operations.application.usecase.MediaStorageProperties;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({IdentityAccessProperties.class, MediaStorageProperties.class})
public class BootstrapApplication {

    public static void main(String[] args) {
        SpringApplication.run(BootstrapApplication.class, args);
    }
}
