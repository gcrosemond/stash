package scene

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
)

func TestDestroyMovieDestroysVirtualScenesFirst(t *testing.T) {
	ctx := context.Background()
	db := mocks.NewDatabase()
	service := &Service{
		Repository:       db.Scene,
		MarkerRepository: db.SceneMarker,
	}
	movie := &models.Scene{ID: 10, Type: models.SceneTypeMovie}
	virtual := &models.Scene{ID: 20, Type: models.SceneTypeVirtual}

	db.Scene.On("FindBySourceSceneID", ctx, movie.ID).Return([]*models.Scene{virtual}, nil).Once()
	db.SceneMarker.On("FindBySceneID", ctx, virtual.ID).Return(nil, nil).Once()
	db.SceneMarker.On("FindBySceneID", ctx, movie.ID).Return(nil, nil).Once()
	db.Scene.On("Destroy", ctx, virtual.ID).Return(nil).Once()
	db.Scene.On("Destroy", ctx, movie.ID).Return(nil).Once()

	if err := service.Destroy(ctx, movie, nil, false, false, false); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}

	db.AssertExpectations(t)
}

func TestDestroyVirtualSceneNeverTouchesPhysicalFile(t *testing.T) {
	ctx := context.Background()
	db := mocks.NewDatabase()
	service := &Service{
		Repository:       db.Scene,
		MarkerRepository: db.SceneMarker,
	}
	virtual := &models.Scene{ID: 20, Type: models.SceneTypeVirtual}

	db.SceneMarker.On("FindBySceneID", ctx, virtual.ID).Return(nil, nil).Once()
	db.Scene.On("Destroy", ctx, virtual.ID).Return(nil).Once()

	// Passing deletion flags and no file deleter ensures the virtual-scene
	// guard is what prevents any physical-file operation.
	if err := service.Destroy(ctx, virtual, nil, false, true, true); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}

	db.AssertExpectations(t)
}
