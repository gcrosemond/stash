package manager

import (
	"context"
	"math"
	"testing"

	"github.com/stashapp/stash/internal/manager/config"
	"github.com/stashapp/stash/pkg/models"
)

func TestVirtualCoverTimestamp(t *testing.T) {
	const start = 100.0
	const end = 200.0

	tests := []struct {
		name  string
		cover *float64
		want  float64
	}{
		{name: "unset", want: 120},
		{name: "start placeholder", cover: ptr(start), want: 120},
		{name: "end boundary", cover: ptr(end), want: 120},
		{name: "selected frame", cover: ptr(150), want: 150},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := virtualCoverTimestamp(start, end, tt.cover)
			if math.Abs(got-tt.want) > 0.0001 {
				t.Fatalf("virtualCoverTimestamp() = %v, want %v", got, tt.want)
			}
		})
	}
}

func ptr(value float64) *float64 { return &value }

func TestQueueSceneJobsUsesVirtualPhash(t *testing.T) {
	config.InitializeEmpty()

	start := 10.0
	end := 20.0
	virtual := &models.Scene{
		ID:           42,
		Type:         models.SceneTypeVirtual,
		StartSeconds: &start,
		EndSeconds:   &end,
	}
	job := GenerateJob{
		input: GenerateMetadataInput{Phashes: true},
	}
	queue := make(chan Task, 1)

	job.queueSceneJobs(context.Background(), nil, virtual, queue)

	select {
	case task := <-queue:
		virtualTask, ok := task.(*GenerateVirtualPhashTask)
		if !ok {
			t.Fatalf("queued task = %T, want *GenerateVirtualPhashTask", task)
		}
		if virtualTask.SceneID != virtual.ID {
			t.Fatalf("virtual phash scene ID = %d, want %d", virtualTask.SceneID, virtual.ID)
		}
	default:
		t.Fatal("expected virtual phash task")
	}
}
