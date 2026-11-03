FROM node:24-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM golang:1.27-alpine AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/jianwei ./cmd/server

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && adduser -D app
WORKDIR /app
COPY --from=backend /out/jianwei /app/jianwei
COPY --from=frontend /src/frontend/dist /app/web
USER app
ENV HTTP_ADDR=0.0.0.0:4180 WEB_DIR=/app/web
EXPOSE 4180
CMD ["/app/jianwei"]
