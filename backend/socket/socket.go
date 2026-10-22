package socket

import (
	"context"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/services"
	"mymate-backend/utils"

	"github.com/gin-gonic/gin"
	socketio "github.com/googollee/go-socket.io"
	"github.com/googollee/go-socket.io/engineio"
	"github.com/googollee/go-socket.io/engineio/transport"
	"github.com/googollee/go-socket.io/engineio/transport/polling"
	"github.com/googollee/go-socket.io/engineio/transport/websocket"
	"go.mongodb.org/mongo-driver/v2/bson"
)

var (
	Server        *socketio.Server
	lastDBUpdate  sync.Map
)

type LocationUpdateEvent struct {
	BookingID string  `json:"bookingId"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Heading   float64 `json:"heading,omitempty"`
}

func InitSocket() *socketio.Server {
	pt := polling.Default
	wt := websocket.Default
	wt.CheckOrigin = func(req *http.Request) bool {
		return true
	}

	opts := &engineio.Options{
		Transports: []transport.Transport{
			pt,
			wt,
		},
	}

	server := socketio.NewServer(opts)

	server.OnConnect("/", func(s socketio.Conn) error {
		rawCookie := s.RemoteHeader().Get("Cookie")
		token := ""
		if rawCookie != "" {
			for _, part := range strings.Split(rawCookie, ";") {
				kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
				if len(kv) == 2 && kv[0] == "token" {
					token = kv[1]
					break
				}
			}
		}
		if token == "" {
			u := s.URL()
			token = u.Query().Get("token")
		}

		if token != "" {
			claims, err := utils.VerifyToken(token)
			if err == nil {
				s.SetContext(claims)
				s.Join(claims.ID)
				log.Printf("[Socket] Client connected: %s, UserID: %s", s.ID(), claims.ID)
				return nil
			}
		}

		log.Printf("[Socket] Guest connected: %s", s.ID())
		return nil
	})

	server.OnEvent("/", "join_booking", func(s socketio.Conn, bookingID string) {
		s.Join("booking_" + bookingID)
	})

	server.OnEvent("/", "leave_booking", func(s socketio.Conn, bookingID string) {
		s.Leave("booking_" + bookingID)
	})

	server.OnEvent("/", "join_conversation", func(s socketio.Conn, convID string) {
		s.Join("conv_" + convID)
	})

	server.OnEvent("/", "leave_conversation", func(s socketio.Conn, convID string) {
		s.Leave("conv_" + convID)
	})

	server.OnEvent("/", "typing_start", func(s socketio.Conn, convID string) {
		userID := ""
		if ctx := s.Context(); ctx != nil {
			if claims, ok := ctx.(*utils.JWTClaims); ok {
				userID = claims.ID
			}
		}
		server.BroadcastToRoom("/", "conv_"+convID, "typing_start", map[string]interface{}{
			"conversationId": convID,
			"userId":         userID,
		})
	})

	server.OnEvent("/", "typing_stop", func(s socketio.Conn, convID string) {
		userID := ""
		if ctx := s.Context(); ctx != nil {
			if claims, ok := ctx.(*utils.JWTClaims); ok {
				userID = claims.ID
			}
		}
		server.BroadcastToRoom("/", "conv_"+convID, "typing_stop", map[string]interface{}{
			"conversationId": convID,
			"userId":         userID,
		})
	})

	server.OnEvent("/", "location_update", func(s socketio.Conn, data LocationUpdateEvent) {
		var driverID string
		if ctx := s.Context(); ctx != nil {
			if claims, ok := ctx.(*utils.JWTClaims); ok {
				driverID = claims.ID
			}
		}

		server.BroadcastToRoom("/", "booking_"+data.BookingID, "location_update", map[string]interface{}{
			"driverId":  driverID,
			"lat":       data.Lat,
			"lng":       data.Lng,
			"heading":   data.Heading,
			"timestamp": time.Now().UnixMilli(),
		})

		// Throttle DB updates per driver (once every 10s)
		if driverID != "" && config.DB != nil {
			now := time.Now().UnixMilli()
			lastVal, exists := lastDBUpdate.Load(driverID)
			if !exists || now-lastVal.(int64) > 10000 {
				lastDBUpdate.Store(driverID, now)

				go func() {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()

					dObjID, err := bson.ObjectIDFromHex(driverID)
					if err == nil {
						_, _ = config.DB.Collection("drivers").UpdateOne(ctx,
							bson.D{{Key: "_id", Value: dObjID}},
							bson.D{{Key: "$set", Value: bson.D{
								{Key: "location", Value: models.GeoPoint{
									Type:        "Point",
									Coordinates: []float64{data.Lng, data.Lat},
								}},
							}}},
						)
					}

					// Geofence check
					bObjID, err := bson.ObjectIDFromHex(data.BookingID)
					if err == nil {
						var booking models.Booking
						err := config.DB.Collection("bookings").FindOne(ctx, bson.D{{Key: "_id", Value: bObjID}}).Decode(&booking)
						if err == nil && booking.Status == "ongoing" && !booking.DriverArrivedNotified && booking.PickupCoordinates != nil {
							distMeters := services.HaversineKm(data.Lat, data.Lng, booking.PickupCoordinates.Lat, booking.PickupCoordinates.Lng) * 1000.0
							if distMeters <= 500 {
								_, _ = config.DB.Collection("bookings").UpdateOne(ctx,
									bson.D{{Key: "_id", Value: bObjID}},
									bson.D{{Key: "$set", Value: bson.D{{Key: "driverArrivedNotified", Value: true}}}},
								)

								_ = models.CreateNotification(ctx, config.DB, models.Notification{
									User:      booking.User,
									UserModel: "User",
									Title:     "Driver Arriving Soon",
									Message:   "Your driver is within 500 meters of the pickup location.",
									Type:      "system",
									Link:      "/bookings/" + booking.ID.Hex(),
								})

								server.BroadcastToRoom("/", booking.User.Hex(), "notification", map[string]string{
									"title":   "Driver Arriving Soon",
									"message": "Your driver is arriving shortly!",
								})
							}
						}
					}
				}()
			}
		}
	})

	server.OnError("/", func(s socketio.Conn, e error) {
		log.Printf("[Socket Warning] Connection error: %v", e)
	})

	server.OnDisconnect("/", func(s socketio.Conn, reason string) {
		log.Printf("[Socket] Disconnected: %s (%s)", s.ID(), reason)
	})

	go func() {
		if err := server.Serve(); err != nil {
			log.Printf("[Socket Error] Server serve error: %v", err)
		}
	}()

	Server = server
	return Server
}

func Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if Server != nil {
			Server.ServeHTTP(c.Writer, c.Request)
		}
	}
}

func EmitBookingUpdate(bookingID string, data interface{}) {
	if Server != nil {
		Server.BroadcastToRoom("/", "booking_"+bookingID, "booking_update", data)
	}
}

func EmitNotification(userID string, data interface{}) {
	if Server != nil {
		Server.BroadcastToRoom("/", userID, "new_notification", data)
		Server.BroadcastToRoom("/", userID, "notification", data)
	}
}

func EmitChatMessage(convID string, message interface{}) {
	if Server != nil {
		Server.BroadcastToRoom("/", "conv_"+convID, "receive_message", message)
	}
}
