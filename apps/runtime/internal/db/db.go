package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	Host     string
	Port     int
	Database string
	User     string
	Password string
}

type DB struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, cfg Config) (*DB, error) {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("error parsing config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("error connecting to database: %w", err)
	}

	db := &DB{pool: pool}
	if err := db.initialize(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return db, nil
}

func (db *DB) initialize(ctx context.Context) error {
	// Create TimescaleDB extension if not exists
	if _, err := db.pool.Exec(ctx, "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"); err != nil {
		return fmt.Errorf("error creating timescaledb extension: %w", err)
	}

	// Create tags table
	if _, err := db.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS tags (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL UNIQUE,
			data_type VARCHAR(50) NOT NULL,
			description TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`); err != nil {
		return fmt.Errorf("error creating tags table: %w", err)
	}

	// Create tag_values hypertable
	if _, err := db.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS tag_values (
			time TIMESTAMPTZ NOT NULL,
			tag_id INTEGER NOT NULL,
			value_bool BOOLEAN,
			value_int INTEGER,
			value_float DOUBLE PRECISION,
			value_string TEXT,
			quality SMALLINT NOT NULL,
			FOREIGN KEY (tag_id) REFERENCES tags(id)
		)`); err != nil {
		return fmt.Errorf("error creating tag_values table: %w", err)
	}

	// Convert to hypertable if not already
	if _, err := db.pool.Exec(ctx, `
		SELECT create_hypertable('tag_values', 'time', if_not_exists => TRUE)
	`); err != nil {
		return fmt.Errorf("error creating hypertable: %w", err)
	}

	return nil
}

func (db *DB) Close() {
	if db.pool != nil {
		db.pool.Close()
	}
}

// InsertTagValue inserts a new value for a tag
func (db *DB) InsertTagValue(ctx context.Context, tagID int, timestamp time.Time, value interface{}, quality int16) error {
	query := `
		INSERT INTO tag_values (time, tag_id, value_bool, value_int, value_float, value_string, quality)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	var valueBool *bool
	var valueInt *int
	var valueFloat *float64
	var valueString *string

	switch v := value.(type) {
	case bool:
		valueBool = &v
	case int:
		valueInt = &v
	case float64:
		valueFloat = &v
	case string:
		valueString = &v
	default:
		return fmt.Errorf("unsupported value type: %T", value)
	}

	_, err := db.pool.Exec(ctx, query,
		timestamp,
		tagID,
		valueBool,
		valueInt,
		valueFloat,
		valueString,
		quality,
	)
	return err
}

// GetTagValues retrieves tag values within a time range
func (db *DB) GetTagValues(ctx context.Context, tagID int, start, end time.Time) (pgx.Rows, error) {
	query := `
		SELECT time,
			COALESCE(value_bool, value_int::bool, value_float::bool) as bool_value,
			COALESCE(value_int, value_float::int) as int_value,
			COALESCE(value_float, value_int::float8) as float_value,
			value_string,
			quality
		FROM tag_values
		WHERE tag_id = $1 AND time BETWEEN $2 AND $3
		ORDER BY time ASC
	`
	return db.pool.Query(ctx, query, tagID, start, end)
}
