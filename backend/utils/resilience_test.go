package utils

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestRetryWithBackoff_Success(t *testing.T) {
	ctx := context.Background()
	cfg := RetryConfig{
		MaxAttempts:     3,
		InitialInterval: 5 * time.Millisecond,
		MaxInterval:     20 * time.Millisecond,
		Multiplier:      2.0,
		Jitter:          false,
	}

	calls := 0
	err := RetryWithBackoff(ctx, cfg, func(attempt int) error {
		calls++
		if attempt < 2 {
			return errors.New("transient error")
		}
		return nil
	})

	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if calls != 2 {
		t.Fatalf("expected 2 calls, got %d", calls)
	}
}

func TestRetryWithBackoff_MaxRetriesExceeded(t *testing.T) {
	ctx := context.Background()
	cfg := RetryConfig{
		MaxAttempts:     3,
		InitialInterval: 5 * time.Millisecond,
		MaxInterval:     10 * time.Millisecond,
		Multiplier:      2.0,
		Jitter:          true,
	}

	calls := 0
	expectedErr := errors.New("permanent error")
	err := RetryWithBackoff(ctx, cfg, func(attempt int) error {
		calls++
		return expectedErr
	})

	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected %v, got %v", expectedErr, err)
	}
	if calls != 3 {
		t.Fatalf("expected 3 calls, got %d", calls)
	}
}

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	cb := NewCircuitBreaker(2, 50*time.Millisecond)

	if cb.State() != StateClosed {
		t.Fatalf("expected closed, got %s", cb.State())
	}

	// 1st failure
	_ = cb.Execute(func() error { return errors.New("fail 1") })
	if cb.State() != StateClosed {
		t.Fatalf("expected closed after 1 failure, got %s", cb.State())
	}

	// 2nd failure triggers open
	_ = cb.Execute(func() error { return errors.New("fail 2") })
	if cb.State() != StateOpen {
		t.Fatalf("expected open after 2 failures, got %s", cb.State())
	}

	// Request while open rejected
	err := cb.Execute(func() error { return nil })
	if !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("expected ErrCircuitOpen, got %v", err)
	}

	// Wait for reset timeout
	time.Sleep(60 * time.Millisecond)

	// In half-open state, success closes the breaker
	err = cb.Execute(func() error { return nil })
	if err != nil {
		t.Fatalf("expected success in half-open, got %v", err)
	}
	if cb.State() != StateClosed {
		t.Fatalf("expected closed after successful probe, got %s", cb.State())
	}
}
