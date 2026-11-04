package domain

import (
	"testing"
	"time"
)

func fixture() Workspace {
	w := Empty()
	w.Bloggers = []Blogger{{ID: "b1", Name: "测试博主", Color: "purple"}}
	w.Records = []Record{{ID: "r1", BloggerID: "b1", Title: "记录当时的判断", Target: "测试主题", Direction: "观望", Kind: "观点", Quote: "等待条件得到验证", Date: "2026-01-01", Status: "published", Verified: true}}
	return w
}

func TestValidation(t *testing.T) {
	now := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	if err := Validate(fixture(), now); err != nil {
		t.Fatal(err)
	}
	cases := map[string]func(*Workspace){
		"broken relationship": func(w *Workspace) { w.Records[0].BloggerID = "unknown" },
		"duplicate blogger":   func(w *Workspace) { w.Bloggers = append(w.Bloggers, w.Bloggers[0]) },
		"duplicate record":    func(w *Workspace) { w.Records = append(w.Records, w.Records[0]) },
		"missing target":      func(w *Workspace) { w.Records[0].Target = "" },
		"impossible date":     func(w *Workspace) { w.Records[0].Date = "2026-02-30" },
		"future date":         func(w *Workspace) { w.Records[0].Date = "2027-01-01" },
		"early due":           func(w *Workspace) { w.Records[0].Due = "2025-12-31" },
		"script URL":          func(w *Workspace) { w.Records[0].Source = "javascript:alert(1)" },
		"credential URL":      func(w *Workspace) { w.Records[0].Source = "https://name:secret@example.com" },
		"status mismatch":     func(w *Workspace) { w.Records[0].Verified = false },
		"invalid rating": func(w *Workspace) {
			w.Records[0].Review = &Review{Date: "2026-01-05", Ratings: []int{6, 3, 3, 3}, Outcome: "证据"}
		},
		"early review": func(w *Workspace) {
			w.Records[0].Review = &Review{Date: "2025-12-31", Ratings: []int{3, 3, 3, 3}, Outcome: "证据"}
		},
		"invalid verdict": func(w *Workspace) {
			w.Records[0].Review = &Review{Date: "2026-01-05", Ratings: []int{3, 3, 3, 3}, Outcome: "证据", Verdict: "partial"}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			w := fixture()
			mutate(&w)
			if Validate(w, now) == nil {
				t.Fatal("invalid data accepted")
			}
		})
	}
}

func TestOptionalOpinionFields(t *testing.T) {
	for _, verified := range []bool{false, true} {
		for _, fields := range []string{"title", "quote", "both"} {
			w := fixture()
			w.Records[0].Verified = verified
			if !verified {
				w.Records[0].Status = "draft"
			}
			if fields == "title" || fields == "both" {
				w.Records[0].Title = ""
			}
			if fields == "quote" || fields == "both" {
				w.Records[0].Quote = ""
			}
			if err := Validate(w, time.Date(2026, 11, 4, 0, 0, 0, 0, time.UTC)); err != nil {
				t.Fatalf("optional %s rejected (verified=%v): %v", fields, verified, err)
			}
		}
	}
}

func TestReviewVerdictCompatibility(t *testing.T) {
	for _, verdict := range []string{"", "success", "failure"} {
		w := fixture()
		w.Records[0].Review = &Review{Date: "2026-01-05", Ratings: []int{3, 3, 3, 3}, Outcome: "证据", Verdict: verdict}
		if err := Validate(w, time.Date(2026, 11, 4, 0, 0, 0, 0, time.UTC)); err != nil {
			t.Fatalf("verdict %q rejected: %v", verdict, err)
		}
	}
}

func TestBeijingDateBoundary(t *testing.T) {
	utc := time.Date(2026, 11, 2, 16, 1, 0, 0, time.UTC)
	if Today(utc) != "2026-11-03" {
		t.Fatal("dates must follow Asia/Shanghai")
	}
}

func TestResultWithoutRatings(t *testing.T) {
	for _, verdict := range []string{"success", "failure", ""} {
		w := fixture()
		w.Records[0].Review = &Review{Date: "2026-01-05", Verdict: verdict, Ratings: []int{}}
		if err := Validate(w, time.Date(2026, 11, 4, 0, 0, 0, 0, time.UTC)); err != nil {
			t.Fatalf("score-free result %q rejected: %v", verdict, err)
		}
	}
	for _, ratings := range [][]int{{3}, {3, 3}, {3, 3, 3}, {3, 3, 3, 3, 3}} {
		w := fixture()
		w.Records[0].Review = &Review{Date: "2026-01-05", Verdict: "success", Ratings: ratings, Outcome: "证据"}
		if Validate(w, time.Date(2026, 11, 4, 0, 0, 0, 0, time.UTC)) == nil {
			t.Fatalf("partial ratings accepted: %v", ratings)
		}
	}
}

func TestOptionalReviewNotesWithRatings(t *testing.T) {
	w := fixture()
	w.Records[0].Review = &Review{Date: "2026-01-05", Verdict: "success", Ratings: []int{0, 3, 4, 5}}
	if err := Validate(w, time.Date(2026, 11, 4, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("optional evidence and lesson rejected: %v", err)
	}
}
