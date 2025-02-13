package runtime

import (
	"context"
	"sync"
	"time"
)

type Config struct {
	ScanTime time.Duration
	DataDir  string
}

type Runtime struct {
	mu        sync.RWMutex
	config    Config
	variables map[string]*Variable
	tasks     []*Task
	version   *Version
	done      chan struct{}
}

type Variable struct {
	Name      string
	DataType  DataType
	Value     interface{}
	Quality   Quality
	Timestamp time.Time
}

type DataType int

const (
	TypeBool DataType = iota
	TypeInt
	TypeFloat
	TypeString
)

type Quality int

const (
	QualityGood Quality = iota
	QualityBad
	QualityUncertain
)

type Task struct {
	Name     string
	Program  *Program
	Interval time.Duration
	Priority int
}

type Version struct {
	ID        string
	Timestamp time.Time
	State     VersionState
	Program   *Program
	Parent    *Version
}

type VersionState int

const (
	VersionActive VersionState = iota
	VersionTesting
	VersionPending
	VersionArchived
)

func New(config Config) (*Runtime, error) {
	return &Runtime{
		config:    config,
		variables: make(map[string]*Variable),
		tasks:     make([]*Task, 0),
		done:      make(chan struct{}),
	}, nil
}

func (r *Runtime) Start(ctx context.Context) error {
	go r.scanCycle(ctx)
	return nil
}

func (r *Runtime) Stop(ctx context.Context) error {
	close(r.done)
	return nil
}

func (r *Runtime) scanCycle(ctx context.Context) {
	ticker := time.NewTicker(r.config.ScanTime)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-r.done:
			return
		case <-ticker.C:
			r.executeCycle()
		}
	}
}

func (r *Runtime) executeCycle() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Execute all tasks in priority order
	for _, task := range r.tasks {
		if err := task.Program.Execute(); err != nil {
			// Handle error, update quality
			continue
		}
	}
}
