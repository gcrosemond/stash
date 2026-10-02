package scraper

import (
	"embed"
	"strings"

	"github.com/stashapp/stash/pkg/logger"
)

// AdultFilmIndexScraperID is the built-in AdultFilmIndex group scraper.
const AdultFilmIndexScraperID = "builtin_adultfilmindex"

//go:embed adultfilmindex.yml
var adultFilmIndexScraperConfig embed.FS

func getAdultFilmIndexScraper(globalConfig GlobalConfig) scraper {
	data, err := adultFilmIndexScraperConfig.ReadFile("adultfilmindex.yml")
	if err != nil {
		logger.Fatalf("Error reading builtin AdultFilmIndex scraper: %s", err.Error())
	}

	definition, err := loadConfigFromYAML(AdultFilmIndexScraperID, strings.NewReader(string(data)))
	if err != nil {
		logger.Fatalf("Error loading builtin AdultFilmIndex scraper: %s", err.Error())
	}

	return scraperFromDefinition(*definition, globalConfig)
}
