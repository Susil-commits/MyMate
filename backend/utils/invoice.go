package utils

import (
	"bytes"
	"fmt"
	"time"

	"mymate-backend/models"

	"github.com/jung-kurt/gofpdf"
)

func GenerateInvoicePDF(booking *models.Booking, user *models.User, driver *models.Driver) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(20, 20, 20)
	pdf.AddPage()

	// Title
	pdf.SetFont("Arial", "B", 20)
	pdf.CellFormat(0, 15, "MyMate Invoice", "", 1, "C", false, 0, "")
	pdf.Ln(5)

	// Booking Info
	pdf.SetFont("Arial", "", 12)
	pdf.CellFormat(0, 8, fmt.Sprintf("Invoice Number: %s", booking.ID.Hex()), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 8, fmt.Sprintf("Date: %s", time.Now().Format("02/01/2006")), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// Customer & Driver
	userName := "Customer"
	userEmail := "N/A"
	if user != nil {
		userName = user.Name
		userEmail = user.Email
	}
	driverName := "Driver"
	driverEmail := "N/A"
	if driver != nil {
		driverName = driver.Name
		driverEmail = driver.Email
	}

	pdf.CellFormat(0, 8, fmt.Sprintf("Customer: %s (%s)", userName, userEmail), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 8, fmt.Sprintf("Driver: %s (%s)", driverName, driverEmail), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// Trip Details
	pdf.CellFormat(0, 8, fmt.Sprintf("Pickup: %s", booking.PickupLocation), "", 1, "L", false, 0, "")
	if booking.DropLocation != "" {
		pdf.CellFormat(0, 8, fmt.Sprintf("Drop: %s", booking.DropLocation), "", 1, "L", false, 0, "")
	}
	if len(booking.Stops) > 0 {
		pdf.CellFormat(0, 8, fmt.Sprintf("Stops: %v", booking.Stops), "", 1, "L", false, 0, "")
	}
	pdf.CellFormat(0, 8, fmt.Sprintf("Hire Type: %s", booking.HireType), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 8, fmt.Sprintf("Start Date: %s", booking.StartDate.Format("02/01/2006 15:04")), "", 1, "L", false, 0, "")
	if booking.EndDate != nil && !booking.EndDate.IsZero() {
		pdf.CellFormat(0, 8, fmt.Sprintf("End Date: %s", booking.EndDate.Format("02/01/2006 15:04")), "", 1, "L", false, 0, "")
	}
	pdf.Ln(4)

	// Pricing breakdown
	pdf.CellFormat(0, 8, fmt.Sprintf("Base Amount: Rs. %.2f", booking.BaseAmount), "", 1, "L", false, 0, "")
	if booking.SurgeMultiplier > 1 {
		pdf.CellFormat(0, 8, fmt.Sprintf("Surge Multiplier: x%.2f", booking.SurgeMultiplier), "", 1, "L", false, 0, "")
	}
	if booking.DiscountAmount > 0 {
		pdf.CellFormat(0, 8, fmt.Sprintf("Discount (%s): - Rs. %.2f", booking.PromoCode, booking.DiscountAmount), "", 1, "L", false, 0, "")
	}
	pdf.Ln(6)

	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 10, fmt.Sprintf("Total Paid: Rs. %.2f", booking.TotalAmount), "T", 1, "L", false, 0, "")
	pdf.Ln(15)

	pdf.SetFont("Arial", "I", 10)
	pdf.CellFormat(0, 8, "Thank you for using MyMate!", "", 1, "C", false, 0, "")

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
