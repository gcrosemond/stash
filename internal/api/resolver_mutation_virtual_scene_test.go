package api

import (
	"context"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/models/mocks"
	"github.com/stashapp/stash/pkg/plugin"
	"github.com/stashapp/stash/pkg/plugin/hook"
	"github.com/stretchr/testify/mock"
)

type recordedHook struct {
	id          int
	hookType    hook.TriggerEnum
	input       interface{}
	inputFields []string
}

type recordingHookExecutor struct {
	calls []recordedHook
}

func (r *recordingHookExecutor) ExecutePostHooks(_ context.Context, id int, hookType hook.TriggerEnum, input interface{}, inputFields []string) {
	r.calls = append(r.calls, recordedHook{
		id:          id,
		hookType:    hookType,
		input:       input,
		inputFields: inputFields,
	})
}

type ignoredRangeReader struct {
	ranges []*models.SceneIgnoredRange
}

func (r ignoredRangeReader) Find(context.Context, int) (*models.SceneIgnoredRange, error) {
	return nil, nil
}

func (r ignoredRangeReader) FindBySceneID(context.Context, int) ([]*models.SceneIgnoredRange, error) {
	return r.ranges, nil
}

func (r ignoredRangeReader) Create(context.Context, *models.SceneIgnoredRange) error {
	return nil
}

func (r ignoredRangeReader) Update(context.Context, *models.SceneIgnoredRange) error {
	return nil
}

func (r ignoredRangeReader) Destroy(context.Context, int) error {
	return nil
}

func TestRangesOverlap(t *testing.T) {
	tests := []struct {
		name           string
		startA, endA   float64
		startB, endB   float64
		expectsOverlap bool
	}{
		{name: "overlap at start", startA: 10, endA: 20, startB: 15, endB: 30, expectsOverlap: true},
		{name: "contained", startA: 10, endA: 30, startB: 15, endB: 20, expectsOverlap: true},
		{name: "touching at end", startA: 10, endA: 20, startB: 20, endB: 30, expectsOverlap: false},
		{name: "separate", startA: 10, endA: 20, startB: 30, endB: 40, expectsOverlap: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := rangesOverlap(tt.startA, tt.endA, tt.startB, tt.endB); got != tt.expectsOverlap {
				t.Fatalf("rangesOverlap() = %v, want %v", got, tt.expectsOverlap)
			}
		})
	}
}

func TestValidateVirtualSceneCover(t *testing.T) {
	valid := 1.0
	negative := -1.0
	before := 9.9
	inside := 15.0
	after := 20.1

	tests := []struct {
		name         string
		cover        *float64
		start, end   float64
		expectsError bool
	}{
		{name: "optional", start: 10, end: 20},
		{name: "at start", cover: &valid, start: 1, end: 20},
		{name: "inside range", cover: &inside, start: 10, end: 20},
		{name: "before range", cover: &before, start: 10, end: 20, expectsError: true},
		{name: "after range", cover: &after, start: 10, end: 20, expectsError: true},
		{name: "negative", cover: &negative, start: 0, end: 20, expectsError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateVirtualSceneCover(tt.cover, tt.start, tt.end)
			if (err != nil) != tt.expectsError {
				t.Fatalf("validateVirtualSceneCover() error = %v, want error: %v", err, tt.expectsError)
			}
		})
	}
}

func TestValidateVirtualSceneRange(t *testing.T) {
	ctx := context.Background()
	db := mocks.NewDatabase()
	db.Scene.On("GetFiles", ctx, 42).Return([]*models.VideoFile{{Duration: 120}}, nil)
	source := &models.Scene{ID: 42}

	tests := []struct {
		name         string
		start, end   float64
		expectsError bool
	}{
		{name: "valid", start: 10, end: 20},
		{name: "zero length", start: 10, end: 10, expectsError: true},
		{name: "negative start", start: -1, end: 10, expectsError: true},
		{name: "past movie end", start: 110, end: 121, expectsError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateVirtualSceneRange(ctx, source, tt.start, tt.end, db.Scene)
			if (err != nil) != tt.expectsError {
				t.Fatalf("validateVirtualSceneRange() error = %v, want error: %v", err, tt.expectsError)
			}
		})
	}
}

func TestValidateVirtualSceneNotIgnored(t *testing.T) {
	ranges := ignoredRangeReader{ranges: []*models.SceneIgnoredRange{{
		ID:           1,
		SceneID:      42,
		StartSeconds: 30,
		EndSeconds:   40,
	}}}

	if err := validateVirtualSceneNotIgnored(context.Background(), 42, 10, 20, ranges); err != nil {
		t.Fatalf("non-overlapping range rejected: %v", err)
	}
	if err := validateVirtualSceneNotIgnored(context.Background(), 42, 35, 45, ranges); err == nil {
		t.Fatal("overlapping range was accepted")
	}
}

func TestSceneIgnoredRangesResolverUsesReadTransaction(t *testing.T) {
	db := mocks.NewDatabase()
	ranges := []*models.SceneIgnoredRange{{
		ID:           1,
		SceneID:      42,
		StartSeconds: 10,
		EndSeconds:   20,
	}}
	resolver := &sceneResolver{&Resolver{repository: models.Repository{
		TxnManager:        db,
		SceneIgnoredRange: ignoredRangeReader{ranges: ranges},
	}}}

	actual, err := resolver.IgnoredRanges(context.Background(), &models.Scene{ID: 42})
	if err != nil {
		t.Fatalf("resolving ignored ranges: %v", err)
	}
	if len(actual) != 1 || actual[0].ID != ranges[0].ID {
		t.Fatalf("IgnoredRanges() = %#v, want %#v", actual, ranges)
	}
}

func TestSourceSceneResolverUsesReadTransaction(t *testing.T) {
	db := mocks.NewDatabase()
	source := &models.Scene{ID: 7, Title: "Source movie"}
	db.Scene.On("Find", mock.Anything, source.ID).Return(source, nil).Once()
	resolver := &sceneResolver{&Resolver{repository: db.Repository()}}

	actual, err := resolver.SourceScene(context.Background(), &models.Scene{
		ID:            42,
		SourceSceneID: &source.ID,
	})
	if err != nil {
		t.Fatalf("resolving source scene: %v", err)
	}
	if actual != source {
		t.Fatalf("SourceScene() = %#v, want %#v", actual, source)
	}
	db.Scene.AssertExpectations(t)
}

func TestSceneConvertFromMovieRequiresConfirmationForDependentData(t *testing.T) {
	db := mocks.NewDatabase()
	movie := &models.Scene{ID: 42, Type: models.SceneTypeMovie}
	db.Scene.On("Find", mock.Anything, movie.ID).Return(movie, nil).Once()
	db.Scene.On("FindBySourceSceneID", mock.Anything, movie.ID).Return(
		[]*models.Scene{{ID: 43, Type: models.SceneTypeVirtual, SourceSceneID: &movie.ID}},
		nil,
	).Once()
	resolver := &mutationResolver{&Resolver{repository: models.Repository{
		TxnManager:        db,
		Scene:             db.Scene,
		SceneIgnoredRange: ignoredRangeReader{},
	}}}

	_, err := resolver.SceneConvertFromMovie(context.Background(), "42", nil)
	if err == nil {
		t.Fatal("converting a movie with virtual scenes succeeded without confirmation")
	}
	db.Scene.AssertExpectations(t)
}

func TestSceneConvertFromMovieEmitsTypeUpdateHook(t *testing.T) {
	db := mocks.NewDatabase()
	movie := &models.Scene{ID: 42, Type: models.SceneTypeMovie}
	converted := &models.Scene{ID: movie.ID, Type: models.SceneTypeNormal}
	db.Scene.On("Find", mock.Anything, movie.ID).Return(movie, nil).Once()
	db.Scene.On("FindBySourceSceneID", mock.Anything, movie.ID).Return([]*models.Scene{}, nil).Once()
	db.Scene.On(
		"UpdatePartial",
		mock.Anything,
		movie.ID,
		mock.MatchedBy(func(partial models.ScenePartial) bool {
			return partial.Type.Set && partial.Type.Value == string(models.SceneTypeNormal)
		}),
	).Return(converted, nil).Once()

	hooks := &recordingHookExecutor{}
	resolver := &mutationResolver{&Resolver{repository: models.Repository{
		TxnManager:        db,
		Scene:             db.Scene,
		SceneIgnoredRange: ignoredRangeReader{},
	}, hookExecutor: hooks}}

	actual, err := resolver.SceneConvertFromMovie(context.Background(), "42", nil)
	if err != nil {
		t.Fatalf("converting movie: %v", err)
	}
	if actual != converted {
		t.Fatalf("SceneConvertFromMovie() = %#v, want %#v", actual, converted)
	}
	if len(hooks.calls) != 1 {
		t.Fatalf("hook calls = %#v, want one update hook", hooks.calls)
	}
	call := hooks.calls[0]
	if call.id != movie.ID || call.hookType != hook.SceneUpdatePost {
		t.Fatalf("hook = %#v, want Scene.Update.Post for %d", call, movie.ID)
	}
	if len(call.inputFields) != 1 || call.inputFields[0] != "type" {
		t.Fatalf("input fields = %#v, want [type]", call.inputFields)
	}

	db.Scene.AssertExpectations(t)
}

func TestVirtualSceneUpdateFields(t *testing.T) {
	start, end, cover := 10.0, 20.0, 15.0
	title := "Updated"
	fields := virtualSceneUpdateFields(VirtualSceneUpdateInput{
		ID:           "42",
		Title:        &title,
		StartSeconds: &start,
		EndSeconds:   &end,
		CoverSeconds: &cover,
	})
	want := []string{"title", "start_seconds", "end_seconds", "cover_seconds"}
	if len(fields) != len(want) {
		t.Fatalf("fields = %#v, want %#v", fields, want)
	}
	for i, field := range want {
		if fields[i] != field {
			t.Fatalf("fields = %#v, want %#v", fields, want)
		}
	}
}

func TestMovieCascadeDestroyHooksIncludeVirtualSceneType(t *testing.T) {
	deleteGenerated, deleteFile, destroyFileEntry := true, true, false
	movie := &models.Scene{ID: 42, Type: models.SceneTypeMovie}
	virtual := &models.Scene{
		ID:   43,
		Type: models.SceneTypeVirtual,
		Path: "/library/movie.mp4",
	}
	hooks := &recordingHookExecutor{}
	resolver := &mutationResolver{&Resolver{hookExecutor: hooks}}
	input := models.SceneDestroyInput{
		ID:               "42",
		DeleteGenerated:  &deleteGenerated,
		DeleteFile:       &deleteFile,
		DestroyFileEntry: &destroyFileEntry,
	}

	resolver.executeSceneDestroyPostHooks(context.Background(), []*models.Scene{movie, virtual}, input)

	if len(hooks.calls) != 2 {
		t.Fatalf("hook calls = %#v, want hooks for movie and virtual child", hooks.calls)
	}
	call := hooks.calls[1]
	payload, ok := call.input.(plugin.SceneDestroyInput)
	if !ok {
		t.Fatalf("hook payload = %T, want plugin.SceneDestroyInput", call.input)
	}
	if call.id != virtual.ID || call.hookType != hook.SceneDestroyPost {
		t.Fatalf("hook = %#v, want Scene.Destroy.Post for virtual scene %d", call, virtual.ID)
	}
	if payload.ID != "43" || payload.Type != models.SceneTypeVirtual || payload.Path != virtual.Path {
		t.Fatalf("virtual destroy payload = %#v, want ID, type, and path for the virtual scene", payload)
	}
	if payload.DeleteGenerated != input.DeleteGenerated || payload.DeleteFile != input.DeleteFile || payload.DestroyFileEntry != input.DestroyFileEntry {
		t.Fatalf("virtual destroy options = %#v, want %#v", payload.SceneDestroyInput, input)
	}
}

func TestMovieRevertCleanupHooksIncludeVirtualSceneType(t *testing.T) {
	virtual := &models.Scene{ID: 43, Type: models.SceneTypeVirtual, Path: "/library/movie.mp4"}
	hooks := &recordingHookExecutor{}
	resolver := &mutationResolver{&Resolver{hookExecutor: hooks}}

	resolver.executeVirtualSceneDestroyPostHooks(context.Background(), []*models.Scene{virtual})

	if len(hooks.calls) != 1 {
		t.Fatalf("hook calls = %#v, want one virtual scene destroy hook", hooks.calls)
	}
	call := hooks.calls[0]
	payload, ok := call.input.(plugin.SceneDestroyInput)
	if !ok {
		t.Fatalf("hook payload = %T, want plugin.SceneDestroyInput", call.input)
	}
	if call.id != virtual.ID || call.hookType != hook.SceneDestroyPost {
		t.Fatalf("hook = %#v, want Scene.Destroy.Post for virtual scene %d", call, virtual.ID)
	}
	if payload.ID != "43" || payload.Type != models.SceneTypeVirtual || payload.Path != virtual.Path {
		t.Fatalf("virtual destroy payload = %#v, want ID, type, and path for the virtual scene", payload)
	}
}

func TestBulkMovieCascadeDestroyHooksIncludeVirtualSceneType(t *testing.T) {
	virtual := &models.Scene{ID: 43, Type: models.SceneTypeVirtual, Path: "/library/movie.mp4"}
	hooks := &recordingHookExecutor{}
	resolver := &mutationResolver{&Resolver{hookExecutor: hooks}}
	input := models.ScenesDestroyInput{Ids: []string{"42"}}

	resolver.executeScenesDestroyPostHooks(context.Background(), []*models.Scene{virtual}, input)

	if len(hooks.calls) != 1 {
		t.Fatalf("hook calls = %#v, want one virtual scene destroy hook", hooks.calls)
	}
	call := hooks.calls[0]
	payload, ok := call.input.(plugin.ScenesDestroyInput)
	if !ok {
		t.Fatalf("hook payload = %T, want plugin.ScenesDestroyInput", call.input)
	}
	if call.id != virtual.ID || call.hookType != hook.SceneDestroyPost {
		t.Fatalf("hook = %#v, want Scene.Destroy.Post for virtual scene %d", call, virtual.ID)
	}
	if len(payload.Ids) != 1 || payload.Ids[0] != "42" || payload.Type != models.SceneTypeVirtual || payload.Path != virtual.Path {
		t.Fatalf("virtual destroy payload = %#v, want bulk input and virtual scene metadata", payload)
	}
}
