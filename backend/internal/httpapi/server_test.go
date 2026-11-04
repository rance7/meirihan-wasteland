package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"jianwei/backend/internal/domain"
	"jianwei/backend/internal/store"
)

type memory struct {
	mu   sync.Mutex
	data domain.Workspace
	fail bool
}

func (m *memory) Get(context.Context) (domain.Workspace, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.data, nil
}
func (m *memory) Ping(context.Context) error {
	if m.fail {
		return errors.New("offline")
	}
	return nil
}
func (m *memory) Save(_ context.Context, next domain.Workspace, revision int64) (domain.Workspace, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.fail {
		return domain.Workspace{}, errors.New("offline")
	}
	if revision != m.data.Revision {
		return domain.Workspace{}, store.ErrConflict
	}
	next.Revision = revision + 1
	m.data = next
	return next, nil
}
func request(handler http.Handler, method, path string, body []byte, headers map[string]string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, bytes.NewReader(body))
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}
func encoded(t *testing.T, w domain.Workspace) []byte {
	t.Helper()
	b, err := json.Marshal(w)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestReadSaveConflict(t *testing.T) {
	repo := &memory{data: domain.Empty()}
	h := New(repo, t.TempDir(), nil)
	w := request(h, "GET", "/api/workspace", nil, nil)
	if w.Code != 200 || w.Header().Get("ETag") != `"0"` {
		t.Fatalf("unexpected read: %d %s", w.Code, w.Body)
	}
	next := domain.Empty()
	next.Bloggers = []domain.Blogger{{ID: "b1", Name: "真实记录", Color: "blue"}}
	headers := map[string]string{"Content-Type": "application/json", "If-Match": `"0"`}
	if w = request(h, "PUT", "/api/workspace", encoded(t, next), headers); w.Code != 200 {
		t.Fatalf("save: %d %s", w.Code, w.Body)
	}
	if repo.data.Revision != 1 || len(repo.data.Bloggers) != 1 {
		t.Fatal("save was not persisted")
	}
	if w = request(h, "PUT", "/api/workspace", encoded(t, next), headers); w.Code != 409 {
		t.Fatalf("stale save accepted: %d", w.Code)
	}
	if len(repo.data.Bloggers) != 1 {
		t.Fatal("conflict must leave stored state untouched")
	}
}

func TestOptionalOpinionFieldsRoundTrip(t *testing.T) {
	repo := &memory{data: domain.Empty()}
	h := New(repo, t.TempDir(), nil)
	next := domain.Empty()
	next.Bloggers = []domain.Blogger{{ID: "b1", Name: "测试博主", Color: "blue"}}
	next.Records = []domain.Record{{ID: "r1", BloggerID: "b1", Target: "测试主题", Direction: "观望", Kind: "观点", Date: "2026-01-01", Status: "draft"}}
	headers := map[string]string{"Content-Type": "application/json", "If-Match": `"0"`}
	w := request(h, "PUT", "/api/workspace", encoded(t, next), headers)
	if w.Code != http.StatusOK {
		t.Fatalf("blank title and quote rejected: %d %s", w.Code, w.Body)
	}
	w = request(h, "GET", "/api/workspace", nil, nil)
	var loaded domain.Workspace
	if err := json.Unmarshal(w.Body.Bytes(), &loaded); err != nil {
		t.Fatal(err)
	}
	if w.Code != http.StatusOK || len(loaded.Records) != 1 || loaded.Records[0].Title != "" || loaded.Records[0].Quote != "" || loaded.Records[0].Target != "测试主题" {
		t.Fatal("optional fields did not survive save/read unchanged")
	}
}

func TestOptionalReviewFieldsRoundTrip(t *testing.T) {
	for _, verdict := range []string{"success", "failure", ""} {
		for _, ratings := range [][]int{{}, {0, 3, 4, 5}} {
			repo := &memory{data: domain.Empty()}
			h := New(repo, t.TempDir(), nil)
			next := domain.Empty()
			next.Bloggers = []domain.Blogger{{ID: "b1", Name: "测试博主", Color: "blue"}}
			next.Records = []domain.Record{{ID: "r1", BloggerID: "b1", Target: "测试主题", Direction: "看多", Kind: "观点", Date: "2026-01-01", Status: "published", Verified: true, Review: &domain.Review{Date: "2026-01-02", Verdict: verdict, Ratings: ratings}}}
			w := request(h, "PUT", "/api/workspace", encoded(t, next), map[string]string{"Content-Type": "application/json", "If-Match": `"0"`})
			if w.Code != http.StatusOK {
				t.Fatalf("optional review %q rejected: %d %s", verdict, w.Code, w.Body)
			}
			w = request(h, "GET", "/api/workspace", nil, nil)
			var loaded domain.Workspace
			if err := json.Unmarshal(w.Body.Bytes(), &loaded); err != nil {
				t.Fatal(err)
			}
			v := loaded.Records[0].Review
			if v == nil || v.Verdict != verdict || len(v.Ratings) != len(ratings) || v.Outcome != "" || !loaded.Records[0].Verified {
				t.Fatal("optional review result did not survive API save/read")
			}
		}
	}
}

func TestInvalidRequests(t *testing.T) {
	repo := &memory{data: domain.Empty()}
	h := New(repo, t.TempDir(), nil)
	valid := encoded(t, domain.Empty())
	for _, tc := range []struct {
		name    string
		body    []byte
		headers map[string]string
		status  int
	}{
		{"missing revision", valid, map[string]string{"Content-Type": "application/json"}, 428},
		{"wrong content type", valid, nil, 415},
		{"invalid JSON", []byte(`{"version":`), map[string]string{"Content-Type": "application/json", "If-Match": `"0"`}, 400},
		{"multiple JSON values", append(append([]byte{}, valid...), []byte(` {}`)...), map[string]string{"Content-Type": "application/json", "If-Match": `"0"`}, 400},
		{"wrong origin", valid, map[string]string{"Content-Type": "application/json", "If-Match": `"0"`, "Origin": "https://untrusted.example"}, 403},
		{"cross site", valid, map[string]string{"Content-Type": "application/json", "If-Match": `"0"`, "Sec-Fetch-Site": "cross-site"}, 403},
		{"invalid workspace", []byte(`{"version":1,"mode":"personal","bloggers":null,"records":[]}`), map[string]string{"Content-Type": "application/json", "If-Match": `"0"`}, 422},
		{"body too large", bytes.Repeat([]byte{' '}, MaxBody+1), map[string]string{"Content-Type": "application/json", "If-Match": `"0"`}, 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := request(h, "PUT", "/api/workspace", tc.body, tc.headers)
			if w.Code != tc.status {
				t.Fatalf("got %d, want %d: %s", w.Code, tc.status, w.Body)
			}
			if repo.data.Revision != 0 {
				t.Fatal("invalid request changed data")
			}
		})
	}
}

func TestDatabaseFailure(t *testing.T) {
	repo := &memory{data: domain.Empty(), fail: true}
	h := New(repo, t.TempDir(), nil)
	if w := request(h, "GET", "/api/health", nil, nil); w.Code != 503 {
		t.Fatal(w.Code)
	}
	w := request(h, "PUT", "/api/workspace", encoded(t, domain.Empty()), map[string]string{"Content-Type": "application/json", "If-Match": `"0"`})
	if w.Code != 503 || repo.data.Revision != 0 {
		t.Fatal("failure must not report successful save")
	}
}

func TestDemoCannotBePersisted(t *testing.T) {
	repo := &memory{data: domain.Empty()}
	h := New(repo, t.TempDir(), nil)
	next := domain.Empty()
	next.Mode = "demo"
	w := request(h, "PUT", "/api/workspace", encoded(t, next), map[string]string{"Content-Type": "application/json", "If-Match": `"0"`})
	if w.Code != 422 || repo.data.Revision != 0 {
		t.Fatal("demo data must not enter the personal database")
	}
}

func TestStaticFilesAndAPIFallback(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("React frontend"), 0600); err != nil {
		t.Fatal(err)
	}
	h := New(&memory{data: domain.Empty()}, dir, nil)
	if w := request(h, "GET", "/", nil, nil); w.Code != 200 || w.Body.String() != "React frontend" {
		t.Fatal(w.Code, w.Body)
	}
	if w := request(h, "GET", "/api/missing", nil, nil); w.Code != 404 {
		t.Fatal("API errors must not return SPA HTML")
	}
	if w := request(h, "GET", "/.env", nil, nil); w.Code != 404 {
		t.Fatal("hidden files must not be served")
	}
}
