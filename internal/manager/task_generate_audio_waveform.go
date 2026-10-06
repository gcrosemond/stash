package manager

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/pkg/fsutil"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/scene/generate"
)

// GenerateAudioWaveformTask creates a waveform for a scene's source video.
type GenerateAudioWaveformTask struct {
	Scene               models.Scene
	Overwrite           bool
	fileNamingAlgorithm models.HashAlgorithm
}

func (t *GenerateAudioWaveformTask) GetDescription() string {
	return fmt.Sprintf("Generating audio waveform for %s", t.Scene.Path)
}

func (t *GenerateAudioWaveformTask) Start(ctx context.Context) {
	if !t.required() {
		return
	}

	hash := t.Scene.GetGeneratedHash(t.fileNamingAlgorithm)
	g := generate.Generator{
		Encoder:     instance.FFMpeg,
		LockManager: instance.ReadLockManager,
		ScenePaths:  instance.Paths.Scene,
		Overwrite:   t.Overwrite,
	}
	if err := g.AudioWaveform(ctx, t.Scene.Path, hash); err != nil {
		logger.Errorf("error generating audio waveform for %s: %s", t.Scene.Path, err)
		logErrorOutput(err)
	}
}

func (t *GenerateAudioWaveformTask) required() bool {
	if t.Scene.Path == "" {
		return false
	}
	if t.Overwrite {
		return true
	}
	hash := t.Scene.GetGeneratedHash(t.fileNamingAlgorithm)
	exists, _ := fsutil.FileExists(instance.Paths.Scene.GetAudioWaveformPath(hash))
	return !exists
}
