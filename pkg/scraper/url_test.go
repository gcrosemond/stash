package scraper

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadURLRunsPreflightInTheSameSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/preflight":
			if r.Header.Get("Cookie") == "" {
				http.SetCookie(w, &http.Cookie{Name: "accepted", Value: "true", Path: "/"})
			}
			w.WriteHeader(http.StatusNoContent)
		case "/target":
			if _, err := r.Cookie("accepted"); err != nil {
				http.Error(w, "preflight was not preserved", http.StatusForbidden)
				return
			}
			_, _ = w.Write([]byte("target"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	definition := Definition{
		DriverOptions: &scraperDriverOptions{Preflight: []string{server.URL + "/preflight"}},
	}
	reader, err := loadURL(context.Background(), server.URL+"/target", newClient(mockGlobalConfig{}), definition, mockGlobalConfig{})
	require.NoError(t, err)
	body, err := io.ReadAll(reader)
	require.NoError(t, err)
	require.Equal(t, "target", string(body))
}
