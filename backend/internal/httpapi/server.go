package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"jianwei/backend/internal/domain"
	"jianwei/backend/internal/store"
)

const MaxBody = 8 << 20 // Leave headroom below MongoDB's 16 MiB document limit.

type Server struct {
	repo           store.Repository
	webDir         string
	allowedOrigins map[string]bool
}

func New(repo store.Repository, webDir string, origins []string) http.Handler {
	s := &Server{repo: repo, webDir: webDir, allowedOrigins: map[string]bool{}}
	for _, origin := range origins {
		s.allowedOrigins[strings.TrimSpace(origin)] = true
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/workspace", s.get)
	mux.HandleFunc("PUT /api/workspace", s.save)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fail(w, 404, "接口不存在") })
	mux.HandleFunc("/", s.static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Cache-Control", "no-store")
		// Browser writes must be same-origin or from an explicitly configured dev UI.
		// Vite proxies /api, so no permissive CORS headers are needed.
		if r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" {
			origin := r.Header.Get("Origin")
			if origin != "" {
				u, err := url.Parse(origin)
				if err != nil || (!s.allowedOrigins[origin] && u.Host != r.Host) {
					fail(w, 403, "请求来源不受信任")
					return
				}
			}
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				fail(w, 403, "不允许跨站写入")
				return
			}
		}
		mux.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := s.repo.Ping(ctx); err != nil {
		fail(w, 503, "MongoDB 暂时不可用")
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ok", "database": "mongodb"})
}
func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	data, err := s.repo.Get(ctx)
	if err != nil {
		slog.Error("load workspace failed", "error", err)
		fail(w, 503, "读取数据库失败，请检查 MongoDB 连接")
		return
	}
	w.Header().Set("ETag", strconv.Quote(strconv.FormatInt(data.Revision, 10)))
	writeJSON(w, 200, data)
}
func (s *Server) save(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		fail(w, 415, "请使用 application/json")
		return
	}
	match := r.Header.Get("If-Match")
	if len(match) < 3 || match[0] != '"' || match[len(match)-1] != '"' {
		fail(w, 428, "缺少有效修订号，请先刷新数据")
		return
	}
	expected, err := strconv.ParseInt(match[1:len(match)-1], 10, 64)
	if err != nil || expected < 0 || expected >= 1<<53-1 {
		fail(w, 400, "修订号不合法")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxBody)
	decoder := json.NewDecoder(r.Body)
	var next domain.Workspace
	if err = decoder.Decode(&next); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			fail(w, 413, "数据超过 8 MiB 限制，请分批整理")
		} else {
			fail(w, 400, "JSON 格式不合法")
		}
		return
	}
	if err = decoder.Decode(new(any)); err != io.EOF {
		fail(w, 400, "请求只能包含一个 JSON 对象")
		return
	}
	if err = domain.Validate(next, time.Now()); err != nil {
		fail(w, 422, err.Error())
		return
	}
	if next.Mode != "personal" {
		fail(w, 422, "演示数据不能写入个人数据库")
		return
	}
	if next.Revision != expected {
		fail(w, 409, "记录已更新，请先刷新再保存")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	saved, err := s.repo.Save(ctx, next, expected)
	if errors.Is(err, store.ErrConflict) {
		fail(w, 409, "另一个页面已保存了新版本。当前表单已保留，请先导出草稿，再载入最新数据。")
		return
	}
	if err != nil {
		slog.Error("save workspace failed", "error", err)
		fail(w, 503, "保存失败，请检查数据库后重试；当前表单仍保留")
		return
	}
	w.Header().Set("ETag", strconv.Quote(strconv.FormatInt(saved.Revision, 10)))
	writeJSON(w, 200, saved)
}

func (s *Server) static(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		fail(w, http.StatusMethodNotAllowed, "此路径只允许读取")
		return
	}
	// Serve only built frontend files; never expose backend source or configuration.
	name := filepath.Clean(filepath.FromSlash(r.URL.Path))
	name = strings.TrimLeft(name, "/\\")
	if name == "." {
		name = "index.html"
	}
	full := filepath.Join(s.webDir, name)
	rel, err := filepath.Rel(s.webDir, full)
	if err != nil || strings.HasPrefix(rel, "..") || strings.HasPrefix(name, ".") {
		http.NotFound(w, r)
		return
	}
	if info, err := os.Stat(full); err == nil && !info.IsDir() {
		http.ServeFile(w, r, full)
		return
	}
	if filepath.Ext(name) != "" {
		http.NotFound(w, r)
		return
	}
	index := filepath.Join(s.webDir, "index.html")
	if _, err := os.Stat(index); err != nil {
		fail(w, 503, "前端尚未构建，请先运行 npm run build")
		return
	}
	http.ServeFile(w, r, index)
}
