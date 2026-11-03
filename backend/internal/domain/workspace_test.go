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
		"missing evidence": func(w *Workspace) { w.Records[0].Review = &Review{Date: "2026-01-05", Ratings: []int{3, 3, 3, 3}} },
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

func TestBeijingDateBoundary(t *testing.T) {
	utc := time.Date(2026, 11, 2, 16, 1, 0, 0, time.UTC)
	if Today(utc) != "2026-11-03" {
		t.Fatal("dates must follow Asia/Shanghai")
	}
}
