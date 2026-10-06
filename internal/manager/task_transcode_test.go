package manager

import (
	"testing"

	"github.com/stashapp/stash/pkg/models"
)

func TestGenerateTranscodeRequiredSkipsVirtualScenes(t *testing.T) {
	start, end := 10.0, 20.0
	task := GenerateTranscodeTask{
		Scene: models.Scene{
			ID:           42,
			Type:         models.SceneTypeVirtual,
			StartSeconds: &start,
			EndSeconds:   &end,
			Path:         "/movie.mp4",
		},
		Overwrite: true,
	}

	if task.required() {
		t.Fatal("virtual scenes must not require generic transcodes")
	}
}

func TestGenerateTranscodeRequiredSkipsScenesWithoutFiles(t *testing.T) {
	task := GenerateTranscodeTask{
		Scene: models.Scene{ID: 42, Type: models.SceneTypeNormal},
		Overwrite: true,
	}
	task.Scene.Files = models.NewRelatedVideoFiles(nil)

	if task.required() {
		t.Fatal("scenes without a primary file must not require transcodes")
	}
}
