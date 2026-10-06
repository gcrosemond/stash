package api

import (
	"context"

	"github.com/stashapp/stash/pkg/models"
)

type generateMetadataOptionsResolver struct{ *Resolver }

// gqlgen leaves this resolver interface custom because AudioWaveforms is a
// computed field on the persisted generation defaults.
type GenerateMetadataOptionsResolver interface {
	AudioWaveforms(ctx context.Context, obj *models.GenerateMetadataOptions) (*bool, error)
}

func (r *generateMetadataOptionsResolver) AudioWaveforms(ctx context.Context, obj *models.GenerateMetadataOptions) (*bool, error) {
	return &obj.AudioWaveforms, nil
}
