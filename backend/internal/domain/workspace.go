package domain

import (
	"fmt"
	"math"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

type Blogger struct {
	ID       string `json:"id" bson:"id"`
	Name     string `json:"name" bson:"name"`
	Platform string `json:"platform" bson:"platform"`
	Tags     string `json:"tags" bson:"tags"`
	Bio      string `json:"bio" bson:"bio"`
	Color    string `json:"color" bson:"color"`
}

type Review struct {
	Date      string   `json:"date" bson:"date"`
	Verdict   string   `json:"verdict,omitempty" bson:"verdict,omitempty"`
	Ratings   []int    `json:"ratings" bson:"ratings"`
	Outcome   string   `json:"outcome" bson:"outcome"`
	Lesson    string   `json:"lesson" bson:"lesson"`
	Entry     *float64 `json:"entry" bson:"entry"`
	Exit      *float64 `json:"exit" bson:"exit"`
	Benchmark *float64 `json:"benchmark" bson:"benchmark"`
}

type Record struct {
	ID           string  `json:"id" bson:"id"`
	BloggerID    string  `json:"bloggerId" bson:"bloggerId"`
	Title        string  `json:"title" bson:"title"`
	Target       string  `json:"target" bson:"target"`
	Direction    string  `json:"direction" bson:"direction"`
	Kind         string  `json:"kind" bson:"kind"`
	Quote        string  `json:"quote" bson:"quote"`
	Date         string  `json:"date" bson:"date"`
	Due          string  `json:"due" bson:"due"`
	Horizon      string  `json:"horizon" bson:"horizon"`
	Condition    string  `json:"condition" bson:"condition"`
	Invalidation string  `json:"invalidation" bson:"invalidation"`
	Source       string  `json:"source" bson:"source"`
	Status       string  `json:"status" bson:"status"`
	Verified     bool    `json:"verified" bson:"verified"`
	Review       *Review `json:"review" bson:"review"`
}

// Workspace is one atomic MongoDB document. Revision prevents lost updates
// across tabs, and also makes backup restore all-or-nothing on standalone Mongo.
type Workspace struct {
	Version  int       `json:"version" bson:"version"`
	Mode     string    `json:"mode" bson:"mode"`
	Revision int64     `json:"revision" bson:"revision"`
	Bloggers []Blogger `json:"bloggers" bson:"bloggers"`
	Records  []Record  `json:"records" bson:"records"`
}

func Empty() Workspace {
	return Workspace{Version: 1, Mode: "personal", Bloggers: []Blogger{}, Records: []Record{}}
}

func Today(now time.Time) string {
	return now.In(time.FixedZone("Asia/Shanghai", 8*60*60)).Format(time.DateOnly)
}

func ValidDate(value string) bool {
	t, err := time.Parse(time.DateOnly, value)
	return err == nil && t.Format(time.DateOnly) == value
}

func SafeURL(value string) bool {
	u, err := url.Parse(value)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" && u.User == nil
}

func Validate(w Workspace, now time.Time) error {
	if w.Version != 1 || (w.Mode != "personal" && w.Mode != "demo") || w.Revision < 0 {
		return fmt.Errorf("备份版本、空间类型或修订号不合法")
	}
	if w.Bloggers == nil || w.Records == nil || len(w.Bloggers) > 2000 || len(w.Records) > 30000 {
		return fmt.Errorf("博主和记录必须为数组，且不能超过 2000 位博主、30000 条记录")
	}
	check := func(value, name string, max int, required bool) error {
		if !utf8.ValidString(value) || utf8.RuneCountInString(value) > max || (required && strings.TrimSpace(value) == "") {
			return fmt.Errorf("%s 为空或长度超过限制", name)
		}
		return nil
	}
	ids, names := map[string]bool{}, map[string]bool{}
	for _, b := range w.Bloggers {
		for _, f := range []struct {
			value, name string
			max         int
			required    bool
		}{
			{b.ID, "博主 ID", 100, true}, {b.Name, "博主名称", 60, true}, {b.Platform, "平台", 100, false},
			{b.Tags, "主题", 180, false}, {b.Bio, "博主备注", 1000, false},
		} {
			if err := check(f.value, f.name, f.max, f.required); err != nil {
				return err
			}
		}
		if ids[b.ID] || names[strings.TrimSpace(b.Name)] {
			return fmt.Errorf("博主 ID 或名称重复")
		}
		if !oneOf(b.Color, "purple", "blue", "green", "orange", "pink") {
			return fmt.Errorf("博主颜色不合法")
		}
		ids[b.ID], names[strings.TrimSpace(b.Name)] = true, true
	}
	recordIDs := map[string]bool{}
	today := Today(now)
	for _, r := range w.Records {
		for _, f := range []struct {
			value, name string
			max         int
			required    bool
		}{
			{r.ID, "记录 ID", 100, true}, {r.BloggerID, "关联博主", 100, true}, {r.Title, "观点概括", 180, true},
			{r.Target, "标的", 100, true}, {r.Quote, "原话", 10000, true}, {r.Horizon, "判断周期", 30, false},
			{r.Condition, "成立条件", 3000, false}, {r.Invalidation, "失效条件", 3000, false}, {r.Source, "来源", 2000, false},
		} {
			if err := check(f.value, f.name, f.max, f.required); err != nil {
				return err
			}
		}
		if recordIDs[r.ID] || !ids[r.BloggerID] {
			return fmt.Errorf("观点 ID 重复，或关联博主不存在")
		}
		recordIDs[r.ID] = true
		if !oneOf(r.Direction, "看多", "看空", "观望") || !oneOf(r.Kind, "观点", "操作") || !oneOf(r.Status, "draft", "published") {
			return fmt.Errorf("观点方向、类型或状态不合法")
		}
		if (r.Status == "draft") == r.Verified {
			return fmt.Errorf("待核对状态与原文核对标记不一致")
		}
		if !ValidDate(r.Date) || r.Date > today || (r.Due != "" && (!ValidDate(r.Due) || r.Due < r.Date)) {
			return fmt.Errorf("发表日期或计划回看日期不合法")
		}
		if r.Source != "" && !SafeURL(r.Source) {
			return fmt.Errorf("原文来源必须为不含登录凭据的 HTTP / HTTPS 链接")
		}
		if v := r.Review; v != nil {
			if !oneOf(v.Verdict, "", "success", "failure") {
				return fmt.Errorf("复盘判断结果必须为成功、失败或未判定")
			}
			if !r.Verified || r.Status == "draft" {
				return fmt.Errorf("待核对记录不能有复盘")
			}
			if !ValidDate(v.Date) || v.Date < r.Date || v.Date > today {
				return fmt.Errorf("复盘日期应在发表日期至今天之间")
			}
			if len(v.Ratings) != 4 {
				return fmt.Errorf("必须填写四项评分")
			}
			for _, n := range v.Ratings {
				if n < 0 || n > 5 {
					return fmt.Errorf("每项评分必须在 0–5 之间")
				}
			}
			if err := check(v.Outcome, "结果与证据", 10000, true); err != nil {
				return err
			}
			if err := check(v.Lesson, "复盘心得", 5000, false); err != nil {
				return err
			}
			for _, n := range []*float64{v.Entry, v.Exit, v.Benchmark} {
				if n != nil && (math.IsNaN(*n) || math.IsInf(*n, 0)) {
					return fmt.Errorf("价格或基准不是有效数字")
				}
			}
			if (v.Entry == nil) != (v.Exit == nil) || (v.Entry != nil && (*v.Entry <= 0 || *v.Exit < 0)) {
				return fmt.Errorf("起始和结束价格需要同时填写，起始价大于 0，结束价不低于 0")
			}
			if v.Benchmark != nil && *v.Benchmark < -100 {
				return fmt.Errorf("基准涨跌幅不能低于 -100%%")
			}
		}
	}
	return nil
}

func oneOf(s string, values ...string) bool {
	for _, v := range values {
		if s == v {
			return true
		}
	}
	return false
}
