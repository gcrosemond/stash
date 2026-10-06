package api

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/pkg/models"
)

func (r *mutationResolver) SceneIgnoredRangeCreate(ctx context.Context, input SceneIgnoredRangeCreateInput) (*models.SceneIgnoredRange, error) {
	sceneID, err := strconv.Atoi(input.SceneID)
	if err != nil {
		return nil, fmt.Errorf("converting scene id: %w", err)
	}

	ignoredRange := &models.SceneIgnoredRange{
		SceneID:      sceneID,
		StartSeconds: input.StartSeconds,
		EndSeconds:   input.EndSeconds,
	}
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		if err := r.validateIgnoredRange(ctx, ignoredRange); err != nil {
			return err
		}
		return r.repository.SceneIgnoredRange.Create(ctx, ignoredRange)
	}); err != nil {
		return nil, err
	}
	return ignoredRange, nil
}

func (r *mutationResolver) SceneIgnoredRangeUpdate(ctx context.Context, input SceneIgnoredRangeUpdateInput) (*models.SceneIgnoredRange, error) {
	id, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("converting ignored range id: %w", err)
	}

	var ignoredRange *models.SceneIgnoredRange
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		ignoredRange, err = r.repository.SceneIgnoredRange.Find(ctx, id)
		if err != nil {
			return err
		}
		if ignoredRange == nil {
			return fmt.Errorf("ignored range %d not found", id)
		}
		ignoredRange.StartSeconds = input.StartSeconds
		ignoredRange.EndSeconds = input.EndSeconds
		if err := r.validateIgnoredRange(ctx, ignoredRange); err != nil {
			return err
		}
		return r.repository.SceneIgnoredRange.Update(ctx, ignoredRange)
	}); err != nil {
		return nil, err
	}
	return ignoredRange, nil
}

func (r *mutationResolver) SceneIgnoredRangeDestroy(ctx context.Context, id string) (bool, error) {
	rangeID, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting ignored range id: %w", err)
	}
	if err := r.withTxn(ctx, func(ctx context.Context) error {
		return r.repository.SceneIgnoredRange.Destroy(ctx, rangeID)
	}); err != nil {
		return false, err
	}
	return true, nil
}

func (r *mutationResolver) validateIgnoredRange(ctx context.Context, ignoredRange *models.SceneIgnoredRange) error {
	if ignoredRange.StartSeconds < 0 || ignoredRange.EndSeconds <= ignoredRange.StartSeconds {
		return fmt.Errorf("ignored range must have a positive duration")
	}

	scene, err := r.repository.Scene.Find(ctx, ignoredRange.SceneID)
	if err != nil {
		return err
	}
	if scene == nil {
		return fmt.Errorf("scene %d not found", ignoredRange.SceneID)
	}
	if scene.Type != models.SceneTypeMovie {
		return fmt.Errorf("scene %d is not a movie", scene.ID)
	}
	if err := scene.LoadPrimaryFile(ctx, r.repository.File); err != nil {
		return err
	}
	if file := scene.Files.Primary(); file != nil && ignoredRange.EndSeconds > float64(file.Duration) {
		return fmt.Errorf("ignored range ends after movie duration")
	}
	if r.repository.SceneIgnoredRange == nil {
		return nil
	}
	virtualScenes, err := r.repository.Scene.FindBySourceSceneID(ctx, scene.ID)
	if err != nil {
		return err
	}
	for _, virtual := range virtualScenes {
		if virtual.StartSeconds != nil && virtual.EndSeconds != nil && rangesOverlap(
			ignoredRange.StartSeconds,
			ignoredRange.EndSeconds,
			*virtual.StartSeconds,
			*virtual.EndSeconds,
		) {
			return fmt.Errorf("ignored range overlaps virtual scene %d", virtual.ID)
		}
	}
	return nil
}
