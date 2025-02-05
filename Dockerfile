FROM quay.io/maphubs/tiles:v0.12.0

# patch the code files
COPY ./env /app/env
COPY ./models /app/models
COPY ./routes /app/routes
COPY ./services /app/services
COPY app.js connection.js docker-entrypoint.sh /app/

