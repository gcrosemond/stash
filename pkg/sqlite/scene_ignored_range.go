package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/jmoiron/sqlx"

	"github.com/stashapp/stash/pkg/models"
)

type sceneIgnoredRangeRow struct {
	ID           int       `db:"id" goqu:"skipinsert"`
	SceneID      int       `db:"scene_id"`
	StartSeconds float64   `db:"start_seconds"`
	EndSeconds   float64   `db:"end_seconds"`
	CreatedAt    Timestamp `db:"created_at"`
	UpdatedAt    Timestamp `db:"updated_at"`
}

func (r *sceneIgnoredRangeRow) resolve() *models.SceneIgnoredRange {
	return &models.SceneIgnoredRange{
		ID:           r.ID,
		SceneID:      r.SceneID,
		StartSeconds: r.StartSeconds,
		EndSeconds:   r.EndSeconds,
		CreatedAt:    r.CreatedAt.Timestamp,
		UpdatedAt:    r.UpdatedAt.Timestamp,
	}
}

func (r *sceneIgnoredRangeRow) fromModel(o models.SceneIgnoredRange) {
	r.ID = o.ID
	r.SceneID = o.SceneID
	r.StartSeconds = o.StartSeconds
	r.EndSeconds = o.EndSeconds
	r.CreatedAt = Timestamp{Timestamp: o.CreatedAt}
	r.UpdatedAt = Timestamp{Timestamp: o.UpdatedAt}
}

type SceneIgnoredRangeStore struct {
	repository
}

func NewSceneIgnoredRangeStore() *SceneIgnoredRangeStore {
	return &SceneIgnoredRangeStore{repository: repository{
		tableName: "scene_ignored_ranges",
		idColumn:  idColumn,
	}}
}

func (s *SceneIgnoredRangeStore) table() exp.IdentifierExpression {
	return sceneIgnoredRangesTableMgr.table
}

func (s *SceneIgnoredRangeStore) selectDataset() *goqu.SelectDataset {
	return dialect.From(s.table()).Select(s.table().All())
}

func (s *SceneIgnoredRangeStore) Create(ctx context.Context, ignoredRange *models.SceneIgnoredRange) error {
	row := sceneIgnoredRangeRow{}
	row.fromModel(*ignoredRange)
	id, err := sceneIgnoredRangesTableMgr.insertID(ctx, row)
	if err != nil {
		return err
	}
	created, err := s.Find(ctx, id)
	if err != nil {
		return fmt.Errorf("finding ignored range after create: %w", err)
	}
	*ignoredRange = *created
	return nil
}

func (s *SceneIgnoredRangeStore) Update(ctx context.Context, ignoredRange *models.SceneIgnoredRange) error {
	row := sceneIgnoredRangeRow{}
	row.fromModel(*ignoredRange)
	return sceneIgnoredRangesTableMgr.updateByID(ctx, ignoredRange.ID, row)
}

func (s *SceneIgnoredRangeStore) Destroy(ctx context.Context, id int) error {
	return s.destroyExisting(ctx, []int{id})
}

func (s *SceneIgnoredRangeStore) Find(ctx context.Context, id int) (*models.SceneIgnoredRange, error) {
	ret, err := s.getMany(ctx, s.selectDataset().Where(sceneIgnoredRangesTableMgr.byID(id)))
	if err != nil {
		return nil, err
	}
	if len(ret) == 0 {
		return nil, sql.ErrNoRows
	}
	return ret[0], nil
}

func (s *SceneIgnoredRangeStore) FindBySceneID(ctx context.Context, sceneID int) ([]*models.SceneIgnoredRange, error) {
	ret, err := s.getMany(ctx, s.selectDataset().Where(s.table().Col("scene_id").Eq(sceneID)))
	if err != nil {
		return nil, err
	}
	sort.Slice(ret, func(i, j int) bool {
		return ret[i].StartSeconds < ret[j].StartSeconds
	})
	return ret, nil
}

func (s *SceneIgnoredRangeStore) getMany(ctx context.Context, query *goqu.SelectDataset) ([]*models.SceneIgnoredRange, error) {
	var ret []*models.SceneIgnoredRange
	if err := queryFunc(ctx, query, false, func(rows *sqlx.Rows) error {
		var row sceneIgnoredRangeRow
		if err := rows.StructScan(&row); err != nil {
			return err
		}
		ret = append(ret, row.resolve())
		return nil
	}); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return ret, nil
}
