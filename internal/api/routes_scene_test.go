package api

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
)

func TestVirtualStreamRange(t *testing.T) {
	start := 100.0
	end := 160.0
	scene := &models.Scene{
		Type:         models.SceneTypeVirtual,
		StartSeconds: &start,
		EndSeconds:   &end,
	}

	tests := []struct {
		name          string
		relativeStart float64
		wantStart     float64
		wantDuration  float64
		wantOK        bool
	}{
		{name: "initial playback", relativeStart: 0, wantStart: 100, wantDuration: 60, wantOK: true},
		{name: "mid scene seek", relativeStart: 25, wantStart: 125, wantDuration: 35, wantOK: true},
		{name: "negative seek", relativeStart: -5, wantStart: 100, wantDuration: 60, wantOK: true},
		{name: "at scene end", relativeStart: 60, wantOK: false},
		{name: "after scene end", relativeStart: 61, wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotStart, gotDuration, gotOK := virtualStreamRange(scene, tt.relativeStart)
			if gotOK != tt.wantOK || gotStart != tt.wantStart || gotDuration != tt.wantDuration {
				t.Fatalf("virtualStreamRange(%v) = (%v, %v, %v), want (%v, %v, %v)", tt.relativeStart, gotStart, gotDuration, gotOK, tt.wantStart, tt.wantDuration, tt.wantOK)
			}
		})
	}
}
