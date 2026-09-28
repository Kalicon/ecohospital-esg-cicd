# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
COPY src/main ./src/main
COPY src/test ./src/test
COPY public ./public
COPY data/esg_dataset.json ./data/esg_dataset.json
RUN mvn -B -ntp verify

FROM eclipse-temurin:17-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 esg \
    && useradd --uid 10001 --gid esg --no-create-home esg \
    && mkdir -p /app/data && chown -R esg:esg /app
WORKDIR /app
COPY --from=build --chown=esg:esg /build/target/esg-app.jar /app/app.jar
ARG APP_VERSION=development
ENV PORT=8080 APP_ENV=local APP_VERSION=${APP_VERSION} STORAGE_FILE=/app/data/state.json
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD curl --fail --silent http://localhost:8080/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
