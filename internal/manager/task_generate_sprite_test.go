package manager

import (
	"testing"

	"github.com/stashapp/stash/pkg/ffmpeg"
	"github.com/stashapp/stash/pkg/models"
)

func TestConfigureVirtualSpriteRange(t *testing.T) {
	start := 120.0
	end := 150.0
	scene := models.Scene{
		ID:           42,
		Type:         models.SceneTypeVirtual,
		StartSeconds: &start,
		EndSeconds:   &end,
	}
	videoFile := &ffmpeg.VideoFile{
		VideoStreamDuration: 600,
		FrameCount:          60000,
		FrameRate:           100,
	}

	gotStart, gotFrame, err := configureVirtualSpriteRange(scene, videoFile)
	if err != nil {
		t.Fatal(err)
	}
	if gotStart != 120 || gotFrame != 12000 {
		t.Fatalf("unexpected offsets: start=%v frame=%d", gotStart, gotFrame)
	}
	if videoFile.VideoStreamDuration != 30 || videoFile.FrameCount != 3000 {
		t.Fatalf("unexpected logical video range: duration=%v frames=%d", videoFile.VideoStreamDuration, videoFile.FrameCount)
	}
}

func TestConfigureVirtualSpriteRangeRejectsInvalidRange(t *testing.T) {
	start := 10.0
	end := 10.0
	scene := models.Scene{
		ID:           42,
		Type:         models.SceneTypeVirtual,
		StartSeconds: &start,
		EndSeconds:   &end,
	}

	if _, _, err := configureVirtualSpriteRange(scene, &ffmpeg.VideoFile{}); err == nil {
		t.Fatal("expected invalid virtual scene range to fail")
	}
}
