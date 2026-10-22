package utils_test

import (
	"testing"

	"mymate-backend/utils"
)

func TestBuildPagination(t *testing.T) {
	// Total 45, page 1, limit 10 -> totalPages 5, hasNext true, hasPrev false
	p1 := utils.BuildPagination(45, 1, 10)
	if p1.Total != 45 {
		t.Errorf("Expected total 45, got %d", p1.Total)
	}
	if p1.TotalPages != 5 {
		t.Errorf("Expected totalPages 5, got %d", p1.TotalPages)
	}
	if !p1.HasNextPage {
		t.Errorf("Expected HasNextPage to be true for page 1 of 5")
	}
	if p1.HasPrevPage {
		t.Errorf("Expected HasPrevPage to be false for page 1")
	}

	// Middle page: page 3 of 5 -> both hasNext and hasPrev true
	p3 := utils.BuildPagination(45, 3, 10)
	if !p3.HasNextPage || !p3.HasPrevPage {
		t.Errorf("Expected both HasNextPage and HasPrevPage to be true on middle page")
	}

	// Last page: page 5 of 5 -> hasNext false, hasPrev true
	p5 := utils.BuildPagination(45, 5, 10)
	if p5.HasNextPage {
		t.Errorf("Expected HasNextPage to be false on last page")
	}
	if !p5.HasPrevPage {
		t.Errorf("Expected HasPrevPage to be true on page 5")
	}

	// Empty dataset: total 0 -> totalPages 1, hasNext false, hasPrev false
	p0 := utils.BuildPagination(0, 1, 10)
	if p0.TotalPages != 1 {
		t.Errorf("Expected totalPages 1 for 0 items, got %d", p0.TotalPages)
	}
	if p0.HasNextPage || p0.HasPrevPage {
		t.Errorf("Expected false for next and prev with 0 items")
	}
}

func TestClampLimit(t *testing.T) {
	// Default when empty
	if v := utils.ClampLimit("", 10, 100); v != 10 {
		t.Errorf("Expected 10 for empty string, got %d", v)
	}

	// Invalid input fallback to default
	if v := utils.ClampLimit("not-a-number", 10, 100); v != 10 {
		t.Errorf("Expected 10 for invalid input, got %d", v)
	}

	// Normal valid number
	if v := utils.ClampLimit("25", 10, 100); v != 25 {
		t.Errorf("Expected 25, got %d", v)
	}

	// Exceeding maximum should be clamped to max
	if v := utils.ClampLimit("500", 10, 100); v != 100 {
		t.Errorf("Expected clamped to 100, got %d", v)
	}

	// Negative number fallback to default
	if v := utils.ClampLimit("-5", 10, 100); v != 10 {
		t.Errorf("Expected 10 for negative number, got %d", v)
	}
}

func TestParseIntDefault(t *testing.T) {
	if v := utils.ParseIntDefault("7", 1); v != 7 {
		t.Errorf("Expected 7, got %d", v)
	}
	if v := utils.ParseIntDefault("", 1); v != 1 {
		t.Errorf("Expected default 1, got %d", v)
	}
	if v := utils.ParseIntDefault("abc", 5); v != 5 {
		t.Errorf("Expected default 5, got %d", v)
	}
}
