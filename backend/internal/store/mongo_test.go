package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"jianwei/backend/internal/domain"
)

func TestMongoPersistenceAndConcurrentSave(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("set MONGODB_TEST_URI for real MongoDB integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db := fmt.Sprintf("jianwei_test_%d", time.Now().UnixNano())
	repo, err := Open(ctx, uri, db)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if strings.HasPrefix(db, "jianwei_test_") {
			if err := repo.client.Database(db).Drop(cleanupCtx); err != nil {
				t.Error(err)
			}
		}
		_ = repo.Close(cleanupCtx)
	})
	initial, err := repo.Get(ctx)
	if err != nil || initial.Revision != 0 || initial.Bloggers == nil {
		t.Fatal("initial workspace", err)
	}
	next := domain.Empty()
	next.Bloggers = []domain.Blogger{{ID: "b1", Name: "数据库集成测试", Color: "green"}}
	next.Records = []domain.Record{{ID: "r1", BloggerID: "b1", Title: "测试判断", Quote: "原始依据", Target: "测试主题", Direction: "观望", Kind: "观点", Date: "2026-01-01", Verified: true, Status: "published", Review: &domain.Review{Date: "2026-01-02", Ratings: []int{3, 3, 3, 3}, Outcome: "测试证据", Verdict: "success"}}}
	next.Records = append(next.Records, domain.Record{ID: "r2", BloggerID: "b1", Target: "快速核对", Direction: "看空", Kind: "观点", Date: "2026-01-01", Verified: true, Status: "published", Review: &domain.Review{Date: "2026-01-02", Ratings: []int{}, Verdict: "failure"}})
	saved, err := repo.Save(ctx, next, 0)
	if err != nil || saved.Revision != 1 {
		t.Fatal("save", err)
	}
	// Reopening a client must retain data, rather than reinitializing it.
	second, err := Open(ctx, uri, db)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close(context.Background())
	loaded, err := second.Get(ctx)
	if err != nil || loaded.Revision != 1 || loaded.Bloggers[0].Name != "数据库集成测试" {
		t.Fatal("reopen lost data", err)
	}
	if len(loaded.Records) != 2 || loaded.Records[0].Review == nil || loaded.Records[0].Review.Verdict != "success" {
		t.Fatal("review verdict did not survive MongoDB persistence")
	}
	if v := loaded.Records[1].Review; v == nil || v.Verdict != "failure" || len(v.Ratings) != 0 || v.Outcome != "" {
		t.Fatal("score-free result did not survive MongoDB persistence")
	}
	var wg sync.WaitGroup
	results := make(chan error, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := repo.Save(ctx, loaded, 1); results <- err }()
	}
	wg.Wait()
	close(results)
	success, conflicts := 0, 0
	for err := range results {
		if err == nil {
			success++
		} else if errors.Is(err, ErrConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if success != 1 || conflicts != 11 {
		t.Fatalf("lost-update protection failed: successes=%d conflicts=%d", success, conflicts)
	}
}
