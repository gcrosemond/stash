package migrations

import (
	"context"
	"database/sql"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/stashapp/stash/pkg/sqlite"
)

func post87(ctx context.Context, db *sqlx.DB) error {
	m := migrator{db: db}
	return m.withTxn(ctx, func(tx *sqlx.Tx) error {
		rows, err := tx.QueryContext(ctx, `SELECT id, aliases FROM groups WHERE aliases IS NOT NULL AND aliases != ''`)
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var id int
			var aliases sql.NullString
			if err := rows.Scan(&id, &aliases); err != nil {
				return err
			}
			seen := make(map[string]struct{})
			for _, alias := range strings.Split(aliases.String, ",") {
				alias = strings.TrimSpace(alias)
				if alias == "" {
					continue
				}
				key := strings.ToLower(alias)
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO group_aliases (group_id, alias) VALUES (?, ?)`, id, alias); err != nil {
					return err
				}
			}
		}
		if err := rows.Err(); err != nil {
			return err
		}
		if err := rows.Close(); err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx, `ALTER TABLE groups DROP COLUMN aliases`)
		return err
	})
}

func init() {
	sqlite.RegisterPostMigration(87, post87)
}
