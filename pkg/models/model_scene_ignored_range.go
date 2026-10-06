package models

import (
	"context"
	"time"
)

type SceneIgnoredRange struct {
	ID           int       `json:"id"`
	SceneID      int       `json:"scene_id"`
	StartSeconds float64   `json:"start_seconds"`
	EndSeconds   float64   `json:"end_seconds"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type SceneIgnoredRangeReaderWriter interface {
	Find(ctx context.Context, id int) (*SceneIgnoredRange, error)
	FindBySceneID(ctx context.Context, sceneID int) ([]*SceneIgnoredRange, error)
	Create(ctx context.Context, ignoredRange *SceneIgnoredRange) error
	Update(ctx context.Context, ignoredRange *SceneIgnoredRange) error
	Destroy(ctx context.Context, id int) error
}
