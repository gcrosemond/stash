package api

import (
	"context"
	"fmt"
	"strconv"

	"github.com/stashapp/stash/internal/manager"
	"github.com/stashapp/stash/pkg/file"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/plugin"
	"github.com/stashapp/stash/pkg/plugin/hook"
	"github.com/stashapp/stash/pkg/scene"
)

func (r *mutationResolver) SceneConvertToMovie(ctx context.Context, id string) (*models.Scene, error) {
	sceneID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("converting scene id: %w", err)
	}

	var ret *models.Scene
	err = r.withTxn(ctx, func(ctx context.Context) error {
		ret, err = r.convertSceneToMovie(ctx, sceneID)
		return err
	})
	if err != nil {
		return nil, err
	}
	r.hookExecutor.ExecutePostHooks(ctx, ret.ID, hook.SceneUpdatePost, models.SceneUpdateInput{ID: id}, []string{"type"})
	return ret, nil
}

func (r *mutationResolver) ScenesConvertToMovie(ctx context.Context, ids []string) ([]*models.Scene, error) {
	sceneIDs := make([]int, len(ids))
	for i, id := range ids {
		sceneID, err := strconv.Atoi(id)
		if err != nil {
			return nil, fmt.Errorf("converting scene id: %w", err)
		}
		sceneIDs[i] = sceneID
	}

	ret := make([]*models.Scene, 0, len(sceneIDs))
	err := r.withTxn(ctx, func(ctx context.Context) error {
		for _, sceneID := range sceneIDs {
			scene, err := r.convertSceneToMovie(ctx, sceneID)
			if err != nil {
				return err
			}
			ret = append(ret, scene)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	for _, scene := range ret {
		r.hookExecutor.ExecutePostHooks(ctx, scene.ID, hook.SceneUpdatePost, models.SceneUpdateInput{ID: strconv.Itoa(scene.ID)}, []string{"type"})
	}

	return ret, nil
}

func (r *mutationResolver) convertSceneToMovie(ctx context.Context, sceneID int) (*models.Scene, error) {
	scene, err := r.repository.Scene.Find(ctx, sceneID)
	if err != nil {
		return nil, err
	}
	if scene == nil {
		return nil, fmt.Errorf("scene with id %d not found", sceneID)
	}
	if scene.Type == models.SceneTypeVirtual {
		return nil, fmt.Errorf("virtual scene %d cannot be converted to a movie", sceneID)
	}
	if scene.Type == models.SceneTypeMovie {
		return scene, nil
	}
	if err := scene.LoadPrimaryFile(ctx, r.repository.File); err != nil {
		return nil, err
	}
	if scene.Files.Primary() == nil {
		return nil, fmt.Errorf("scene %d has no primary video file", sceneID)
	}

	return r.repository.Scene.UpdatePartial(ctx, sceneID, models.ScenePartial{
		Type: models.NewOptionalString(string(models.SceneTypeMovie)),
	})
}

// SceneConvertFromMovie restores a movie to a normal scene. Destructive cleanup
// requires an explicit opt-in when the movie still owns virtual scene data.
func (r *mutationResolver) SceneConvertFromMovie(ctx context.Context, id string, deleteVirtualScenes *bool) (*models.Scene, error) {
	sceneID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("converting movie id: %w", err)
	}

	var fileDeleter *scene.FileDeleter
	var ret *models.Scene
	var deletedVirtualScenes []*models.Scene
	err = r.withTxn(ctx, func(ctx context.Context) error {
		movie, err := r.repository.Scene.Find(ctx, sceneID)
		if err != nil {
			return err
		}
		if movie == nil {
			return fmt.Errorf("scene with id %d not found", sceneID)
		}
		if movie.Type != models.SceneTypeMovie {
			return fmt.Errorf("scene %d is not a movie", sceneID)
		}

		virtualScenes, err := r.repository.Scene.FindBySourceSceneID(ctx, sceneID)
		if err != nil {
			return err
		}
		ignoredRanges, err := r.repository.SceneIgnoredRange.FindBySceneID(ctx, sceneID)
		if err != nil {
			return err
		}
		if (len(virtualScenes) > 0 || len(ignoredRanges) > 0) && (deleteVirtualScenes == nil || !*deleteVirtualScenes) {
			return fmt.Errorf("movie %d has %d virtual scenes and %d ignored ranges; confirm their deletion before converting it back to a regular scene", sceneID, len(virtualScenes), len(ignoredRanges))
		}

		if len(virtualScenes) > 0 {
			fileNamingAlgo := manager.GetInstance().Config.GetVideoFileNamingAlgorithm()
			fileDeleter = &scene.FileDeleter{
				Deleter:        file.NewDeleterWithTrash(manager.GetInstance().Config.GetDeleteTrashPath()),
				FileNamingAlgo: fileNamingAlgo,
				Paths:          manager.GetInstance().Paths,
			}
		}
		deletedVirtualScenes = virtualScenes
		for _, virtualScene := range virtualScenes {
			if err := r.sceneService.Destroy(ctx, virtualScene, fileDeleter, true, false, false); err != nil {
				return err
			}
		}
		for _, ignoredRange := range ignoredRanges {
			if err := r.repository.SceneIgnoredRange.Destroy(ctx, ignoredRange.ID); err != nil {
				return err
			}
		}

		ret, err = r.repository.Scene.UpdatePartial(ctx, sceneID, models.ScenePartial{
			Type: models.NewOptionalString(string(models.SceneTypeNormal)),
		})
		return err
	})
	if err != nil {
		if fileDeleter != nil {
			fileDeleter.Rollback()
		}
		return nil, err
	}
	if fileDeleter != nil {
		fileDeleter.Commit()
	}
	r.executeVirtualSceneDestroyPostHooks(ctx, deletedVirtualScenes)
	r.hookExecutor.ExecutePostHooks(ctx, ret.ID, hook.SceneUpdatePost, models.SceneUpdateInput{ID: id}, []string{"type"})

	return ret, nil
}

// executeVirtualSceneDestroyPostHooks reports cleanup caused by reverting a movie.
// The virtual scenes have already been removed, so plugins need their type in the
// destroy payload rather than querying the scene after this point.
func (r *mutationResolver) executeVirtualSceneDestroyPostHooks(ctx context.Context, virtualScenes []*models.Scene) {
	for _, virtualScene := range virtualScenes {
		r.hookExecutor.ExecutePostHooks(ctx, virtualScene.ID, hook.SceneDestroyPost, plugin.SceneDestroyInput{
			SceneDestroyInput: models.SceneDestroyInput{ID: strconv.Itoa(virtualScene.ID)},
			Checksum:          virtualScene.Checksum,
			OSHash:            virtualScene.OSHash,
			Path:              virtualScene.Path,
			Type:              virtualScene.Type,
		}, nil)
	}
}

func (r *mutationResolver) VirtualSceneCreate(ctx context.Context, input VirtualSceneCreateInput) (*models.Scene, error) {
	sourceID, err := strconv.Atoi(input.SourceSceneID)
	if err != nil {
		return nil, fmt.Errorf("converting source scene id: %w", err)
	}

	var ret *models.Scene
	err = r.withTxn(ctx, func(ctx context.Context) error {
		source, err := r.repository.Scene.Find(ctx, sourceID)
		if err != nil {
			return err
		}
		if source == nil {
			return fmt.Errorf("source scene with id %d not found", sourceID)
		}
		if source.Type != models.SceneTypeMovie {
			return fmt.Errorf("source scene %d is not a movie", sourceID)
		}
		if err := validateVirtualSceneRange(ctx, source, input.StartSeconds, input.EndSeconds, r.repository.Scene); err != nil {
			return err
		}
		if err := validateVirtualSceneNotIgnored(ctx, source.ID, input.StartSeconds, input.EndSeconds, r.repository.SceneIgnoredRange); err != nil {
			return err
		}
		if err := validateVirtualSceneCover(input.CoverSeconds, input.StartSeconds, input.EndSeconds); err != nil {
			return err
		}

		if err := source.LoadRelationships(ctx, r.repository.Scene); err != nil {
			return err
		}

		virtual := models.NewScene()
		virtual.Type = models.SceneTypeVirtual
		virtual.SourceSceneID = &source.ID
		virtual.StartSeconds = &input.StartSeconds
		virtual.EndSeconds = &input.EndSeconds
		virtual.CoverSeconds = input.CoverSeconds
		if input.Title != nil {
			virtual.Title = *input.Title
		}
		virtual.Code = source.Code
		virtual.Details = source.Details
		virtual.Director = source.Director
		virtual.Date = source.Date
		virtual.ProductionDate = source.ProductionDate
		virtual.Rating = source.Rating
		virtual.Organized = source.Organized
		virtual.StudioID = source.StudioID
		virtual.URLs = source.URLs
		virtual.GalleryIDs = source.GalleryIDs
		virtual.PerformerIDs = source.PerformerIDs
		virtual.Groups = source.Groups
		virtual.TagIDs = source.TagIDs
		virtual.StashIDs = source.StashIDs

		if virtual.Title == "" {
			virtual.Title = fmt.Sprintf("%s (%s-%s)", source.GetTitle(), formatSeconds(input.StartSeconds), formatSeconds(input.EndSeconds))
		}

		var fileIDs []models.FileID
		if source.PrimaryFileID != nil {
			fileIDs = []models.FileID{*source.PrimaryFileID}
		}
		if err := r.repository.Scene.Create(ctx, &virtual, fileIDs); err != nil {
			return err
		}
		ret = &virtual
		return nil
	})
	if err != nil {
		return nil, err
	}
	manager.GetInstance().GenerateVirtualSceneAssets(ctx, ret.ID, false)
	r.hookExecutor.ExecutePostHooks(ctx, ret.ID, hook.SceneCreatePost, input, nil)

	return ret, nil
}

func (r *mutationResolver) VirtualSceneUpdate(ctx context.Context, input VirtualSceneUpdateInput) (*models.Scene, error) {
	virtualID, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, fmt.Errorf("converting virtual scene id: %w", err)
	}

	var ret *models.Scene
	err = r.withTxn(ctx, func(ctx context.Context) error {
		virtual, err := r.repository.Scene.Find(ctx, virtualID)
		if err != nil {
			return err
		}
		if virtual == nil {
			return fmt.Errorf("scene with id %d not found", virtualID)
		}
		if virtual.Type != models.SceneTypeVirtual || virtual.SourceSceneID == nil {
			return fmt.Errorf("scene %d is not a virtual scene", virtualID)
		}

		source, err := r.repository.Scene.Find(ctx, *virtual.SourceSceneID)
		if err != nil {
			return err
		}
		if source == nil || source.Type != models.SceneTypeMovie {
			return fmt.Errorf("source movie for virtual scene %d not found", virtualID)
		}

		start := valueOr(input.StartSeconds, virtual.StartSeconds)
		end := valueOr(input.EndSeconds, virtual.EndSeconds)
		if start == nil || end == nil {
			return fmt.Errorf("virtual scene %d has no complete time range", virtualID)
		}
		if err := validateVirtualSceneRange(ctx, source, *start, *end, r.repository.Scene); err != nil {
			return err
		}
		if err := validateVirtualSceneNotIgnored(ctx, source.ID, *start, *end, r.repository.SceneIgnoredRange); err != nil {
			return err
		}
		cover := valueOr(input.CoverSeconds, virtual.CoverSeconds)
		if err := validateVirtualSceneCover(cover, *start, *end); err != nil {
			return err
		}

		partial := models.NewScenePartial()
		if input.Title != nil {
			partial.Title = models.NewOptionalString(*input.Title)
		}
		partial.StartSeconds = models.NewOptionalFloat64(*start)
		partial.EndSeconds = models.NewOptionalFloat64(*end)
		if cover != nil {
			partial.CoverSeconds = models.NewOptionalFloat64(*cover)
		}
		ret, err = r.repository.Scene.UpdatePartial(ctx, virtualID, partial)
		return err
	})
	if err != nil {
		return nil, err
	}
	manager.GetInstance().GenerateVirtualSceneAssets(ctx, ret.ID, true)
	r.hookExecutor.ExecutePostHooks(ctx, ret.ID, hook.SceneUpdatePost, input, virtualSceneUpdateFields(input))

	return ret, nil
}

func validateVirtualSceneNotIgnored(ctx context.Context, sourceID int, start, end float64, ranges models.SceneIgnoredRangeReaderWriter) error {
	if ranges == nil {
		return nil
	}

	ignoredRanges, err := ranges.FindBySceneID(ctx, sourceID)
	if err != nil {
		return err
	}
	for _, ignored := range ignoredRanges {
		if rangesOverlap(start, end, ignored.StartSeconds, ignored.EndSeconds) {
			return fmt.Errorf("virtual scene range overlaps ignored range %d", ignored.ID)
		}
	}
	return nil
}

func rangesOverlap(startA, endA, startB, endB float64) bool {
	return startA < endB && startB < endA
}

func (r *mutationResolver) VirtualSceneDestroy(ctx context.Context, id string) (bool, error) {
	virtualID, err := strconv.Atoi(id)
	if err != nil {
		return false, fmt.Errorf("converting virtual scene id: %w", err)
	}

	mgr := manager.GetInstance()
	fileDeleter := &scene.FileDeleter{
		Deleter:        file.NewDeleterWithTrash(mgr.Config.GetDeleteTrashPath()),
		FileNamingAlgo: mgr.Config.GetVideoFileNamingAlgorithm(),
		Paths:          mgr.Paths,
	}
	var virtual *models.Scene
	err = r.withTxn(ctx, func(ctx context.Context) error {
		var err error
		virtual, err = r.repository.Scene.Find(ctx, virtualID)
		if err != nil {
			return err
		}
		if virtual == nil {
			return fmt.Errorf("scene with id %d not found", virtualID)
		}
		if virtual.Type != models.SceneTypeVirtual {
			return fmt.Errorf("scene %d is not a virtual scene", virtualID)
		}
		return r.sceneService.Destroy(ctx, virtual, fileDeleter, true, false, false)
	})
	if err != nil {
		fileDeleter.Rollback()
		return false, err
	}
	fileDeleter.Commit()
	r.hookExecutor.ExecutePostHooks(ctx, virtual.ID, hook.SceneDestroyPost, plugin.SceneDestroyInput{
		SceneDestroyInput: models.SceneDestroyInput{ID: id},
		Checksum:          virtual.Checksum,
		OSHash:            virtual.OSHash,
		Path:              virtual.Path,
		Type:              virtual.Type,
	}, nil)
	return true, nil
}

func virtualSceneUpdateFields(input VirtualSceneUpdateInput) []string {
	fields := make([]string, 0, 4)
	if input.Title != nil {
		fields = append(fields, "title")
	}
	if input.StartSeconds != nil {
		fields = append(fields, "start_seconds")
	}
	if input.EndSeconds != nil {
		fields = append(fields, "end_seconds")
	}
	if input.CoverSeconds != nil {
		fields = append(fields, "cover_seconds")
	}
	return fields
}

func validateVirtualSceneRange(ctx context.Context, source *models.Scene, start, end float64, scenes models.SceneReader) error {
	if start < 0 || end <= start {
		return fmt.Errorf("invalid virtual scene range %.3f-%.3f", start, end)
	}

	if err := source.LoadFiles(ctx, scenes); err != nil {
		return err
	}
	primary := source.Files.Primary()
	if primary == nil {
		return fmt.Errorf("movie scene %d has no primary file", source.ID)
	}
	if end > primary.Duration {
		return fmt.Errorf("virtual scene end %.3f exceeds movie duration %.3f", end, primary.Duration)
	}

	return nil
}

func validateVirtualSceneCover(cover *float64, start, end float64) error {
	if cover != nil && (*cover < start || *cover > end) {
		return fmt.Errorf("virtual scene cover time %.3f is outside range %.3f-%.3f", *cover, start, end)
	}
	return nil
}

func valueOr(value *float64, fallback *float64) *float64 {
	if value != nil {
		return value
	}
	return fallback
}

func formatSeconds(seconds float64) string {
	return strconv.FormatFloat(seconds, 'f', -1, 64)
}
