package services

import (
	"regexp"
	"strings"
)

type KycResult struct {
	ExtractedLicenseNumber string   `json:"extractedLicenseNumber"`
	Confidence             int      `json:"confidence"`
	IsValid                bool     `json:"isValid"`
	Flags                  []string `json:"flags"`
}

var licenseRegexes = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b([A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7})\b`),
	regexp.MustCompile(`(?i)\b([A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{6})\b`),
	regexp.MustCompile(`(?i)\b([A-Z]{2}\d{13})\b`),
}

func ValidateLicenseNumber(raw string) KycResult {
	upper := strings.ToUpper(strings.TrimSpace(raw))
	var extracted string

	for _, re := range licenseRegexes {
		match := re.FindStringSubmatch(upper)
		if len(match) > 1 {
			extracted = strings.ReplaceAll(strings.ReplaceAll(match[1], " ", ""), "-", "")
			break
		}
	}

	flags := []string{}
	if extracted == "" {
		flags = append(flags, "NO_LICENSE_NUMBER_FOUND")
	}

	confidence := 85
	if len(flags) > 0 {
		confidence = 30
	}

	return KycResult{
		ExtractedLicenseNumber: extracted,
		Confidence:             confidence,
		IsValid:                extracted != "",
		Flags:                  flags,
	}
}
