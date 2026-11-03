package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"jianwei/backend/internal/httpapi"
	"jianwei/backend/internal/store"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	repo, err := store.Open(ctx, env("MONGODB_URI", "mongodb://127.0.0.1:27017"), env("MONGODB_DATABASE", "jianwei"))
	cancel()
	if err != nil {
		slog.Error("MongoDB unavailable; set MONGODB_URI or start docker compose", "error", err)
		os.Exit(1)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = repo.Close(ctx)
	}()
	server := &http.Server{Addr: env("HTTP_ADDR", "127.0.0.1:4180"), Handler: httpapi.New(repo, env("WEB_DIR", "../frontend/dist"), strings.Split(env("ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"), ",")), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()
	slog.Info("Jianwei Go API + React frontend ready", "address", server.Addr, "database", "mongodb")
	if err = server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("HTTP server failed", "error", err)
		os.Exit(1)
	}
}
