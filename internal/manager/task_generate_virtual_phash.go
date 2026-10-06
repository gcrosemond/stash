package manager

import (
	"context"
	"fmt"

	"github.com/stashapp/stash/pkg/hash/videophash"
	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
)

// GenerateVirtualPhashTask computes a phash for the selected range without
// writing it to the shared source file's fingerprint set.
type GenerateVirtualPhashTask struct {
	repository models.Repository
	SceneID    int
	Overwrite  bool
}

func (t *GenerateVirtualPhashTask) GetDescription() string {
	return fmt.Sprintf("Generating phash for virtual scene %d", t.SceneID)
}

func (t *GenerateVirtualPhashTask) Start(ctx context.Context) {
	var scene *models.Scene
	if err := t.repository.WithReadTxn(ctx, func(ctx context.Context) error {
		var err error
		scene, err = t.repository.Scene.Find(ctx, t.SceneID)
		if err != nil {
			return err
		}
		if scene == nil {
			return fmt.Errorf("virtual scene %d not found", t.SceneID)
		}
		if scene.Type != models.SceneTypeVirtual || scene.StartSeconds == nil || scene.EndSeconds == nil {
			return fmt.Errorf("scene %d is not a valid virtual scene", t.SceneID)
		}
		return scene.LoadPrimaryFile(ctx, t.repository.File)
	}); err != nil {
		logger.Errorf("Error preparing virtual phash: %v", err)
		return
	}

	if !t.Overwrite {
		fingerprint, err := t.repository.Scene.GetFingerprint(ctx, scene.ID, models.FingerprintTypePhash)
		if err != nil {
			logger.Errorf("Error checking virtual phash: %v", err)
			return
		}
		if fingerprint != nil {
			return
		}
	}

	file := scene.Files.Primary()
	if file == nil {
		logger.Errorf("Virtual scene %d has no primary file", scene.ID)
		return
	}
	duration := *scene.EndSeconds - *scene.StartSeconds
	hash, err := videophash.GenerateSegment(instance.FFMpeg, file, *scene.StartSeconds, duration)
	if err != nil {
		logger.Errorf("Error generating virtual phash for %q: %v", file.Path, err)
		logErrorOutput(err)
		return
	}

	if err := t.repository.WithTxn(ctx, func(ctx context.Context) error {
		return t.repository.Scene.UpdateFingerprint(ctx, scene.ID, models.Fingerprint{
			Type:        models.FingerprintTypePhash,
			Fingerprint: int64(*hash),
		})
	}); err != nil && ctx.Err() == nil {
		logger.Errorf("Error setting virtual phash: %v", err)
	}
}
