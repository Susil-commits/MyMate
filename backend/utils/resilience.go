package utils

import (
	"context"
	"errors"
	"math/rand"
	"sync"
	"time"
)

var (
	ErrCircuitOpen     = errors.New("circuit breaker is open; request rejected")
	ErrMaxRetriesExceeded = errors.New("maximum retry attempts exceeded")
)

// RetryConfig specifies parameters for exponential backoff retry.
type RetryConfig struct {
	MaxAttempts     int
	InitialInterval time.Duration
	MaxInterval     time.Duration
	Multiplier      float64
	Jitter          bool
}

// DefaultRetryConfig returns a robust default configuration.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:     3,
		InitialInterval: 100 * time.Millisecond,
		MaxInterval:     2 * time.Second,
		Multiplier:      2.0,
		Jitter:          true,
	}
}

// RetryWithBackoff executes an operation with exponential backoff and randomized jitter.
func RetryWithBackoff(ctx context.Context, cfg RetryConfig, op func(attempt int) error) error {
	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = 3
	}
	if cfg.InitialInterval <= 0 {
		cfg.InitialInterval = 100 * time.Millisecond
	}
	if cfg.MaxInterval <= 0 {
		cfg.MaxInterval = 2 * time.Second
	}
	if cfg.Multiplier < 1.0 {
		cfg.Multiplier = 2.0
	}

	interval := cfg.InitialInterval
	var lastErr error

	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err := op(attempt)
		if err == nil {
			return nil
		}
		lastErr = err

		if attempt == cfg.MaxAttempts {
			break
		}

		// Calculate sleep duration with exponential backoff & full jitter
		sleepDuration := interval
		if cfg.Jitter {
			// Full jitter: random sleep between 0 and current interval
			sleepDuration = time.Duration(rand.Int63n(int64(interval) + 1))
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(sleepDuration):
		}

		// Multiply interval for the next attempt up to MaxInterval
		nextInterval := time.Duration(float64(interval) * cfg.Multiplier)
		if nextInterval > cfg.MaxInterval {
			interval = cfg.MaxInterval
		} else {
			interval = nextInterval
		}
	}

	return lastErr
}

// CircuitState represents the state of a circuit breaker.
type CircuitState string

const (
	StateClosed   CircuitState = "closed"
	StateOpen     CircuitState = "open"
	StateHalfOpen CircuitState = "half_open"
)

// CircuitBreaker protects downstream services from cascading failure.
type CircuitBreaker struct {
	mu           sync.Mutex
	maxFailures  int
	resetTimeout time.Duration
	failures     int
	lastFailure  time.Time
	state        CircuitState
}

// NewCircuitBreaker creates a circuit breaker instance.
func NewCircuitBreaker(maxFailures int, resetTimeout time.Duration) *CircuitBreaker {
	if maxFailures <= 0 {
		maxFailures = 5
	}
	if resetTimeout <= 0 {
		resetTimeout = 10 * time.Second
	}
	return &CircuitBreaker{
		maxFailures:  maxFailures,
		resetTimeout: resetTimeout,
		state:        StateClosed,
	}
}

// State returns the current state of the circuit breaker.
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state == StateOpen && time.Since(cb.lastFailure) > cb.resetTimeout {
		cb.state = StateHalfOpen
	}
	return cb.state
}

// Execute runs the operation through the circuit breaker.
func (cb *CircuitBreaker) Execute(op func() error) error {
	cb.mu.Lock()
	if cb.state == StateOpen {
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = StateHalfOpen
		} else {
			cb.mu.Unlock()
			return ErrCircuitOpen
		}
	}
	cb.mu.Unlock()

	err := op()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.failures++
		cb.lastFailure = time.Now()
		if cb.failures >= cb.maxFailures || cb.state == StateHalfOpen {
			cb.state = StateOpen
		}
		return err
	}

	// Success resets the breaker
	cb.failures = 0
	cb.state = StateClosed
	return nil
}
