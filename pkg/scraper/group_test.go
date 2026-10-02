package scraper

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"
)

func TestGroupScraperCapabilitiesAndDispatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><body>
		<table id="titleresult"><tbody>
		<tr><td><a class="title" href="/title/one"><span>First</span> title</a></td></tr>
		<tr><td><a class="title" href="/title/two"><span>Second</span> title</a></td></tr>
		</tbody></table>
</body></html>`))
	}))
	defer server.Close()

	config := `name: Test Groups
groupByName:
  action: scrapeXPath
  queryURL: ` + server.URL + `/search?q={}
  scraper: groupSearch
groupByFragment:
  action: scrapeXPath
  queryURL: "{url}"
  scraper: groupPage
groupByURL:
  - action: scrapeXPath
    url: ["/title/"]
    scraper: groupPage
xPathScrapers:
  groupSearch:
    group:
      Name: //*[@id='titleresult']//td[1]/a
      URLs:
        selector: //*[@id='titleresult']//td[1]/a/@href
        postProcess:
          - replace:
              - regex: ^/
                with: ` + server.URL + `/
  groupPage:
    group:
      Name: //h1
      URLs:
        selector: //link[@rel='canonical']/@href
`

	var definition Definition
	require.NoError(t, yaml.Unmarshal([]byte(config), &definition))

	s := scraperFromDefinition(definition, mockGlobalConfig{})
	spec := s.spec()
	require.NotNil(t, spec.Group)
	require.ElementsMatch(t, []ScrapeType{ScrapeTypeName, ScrapeTypeFragment, ScrapeTypeURL}, spec.Group.SupportedScrapes)
	require.True(t, s.supports(ScrapeContentTypeGroup))
	require.True(t, s.supportsURL(server.URL+"/title/one", ScrapeContentTypeGroup))

	content, err := s.viaName(context.Background(), &http.Client{}, "title", ScrapeContentTypeGroup)
	require.NoError(t, err)
	require.Len(t, content, 2)
	first, ok := content[0].(*models.ScrapedGroup)
	require.True(t, ok)
	require.Equal(t, "First title", *first.Name)

	fragment := Input{Group: &ScrapedGroupInput{URLs: []string{server.URL + "/title/one"}}}
	_, err = s.viaFragment(context.Background(), &http.Client{}, fragment)
	require.NoError(t, err)
}

func TestInputPopulateGroupURL(t *testing.T) {
	url := "https://example.test/title/one"
	input := Input{Group: &ScrapedGroupInput{URLs: []string{url}}}
	input.populateURL()
	require.NotNil(t, input.Group.URL)
	require.Equal(t, url, *input.Group.URL)
}

func TestAdultFilmIndexDefinitionLoads(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "scrapers", "AdultFilmIndex.yml"))
	require.NoError(t, err)

	definition, err := loadConfigFromYAML("adultfilmindex", bytes.NewReader(data))
	require.NoError(t, err)
	require.NoError(t, definition.validate())
	require.NotNil(t, definition.GroupByName)
	require.NotNil(t, definition.GroupByFragment)
	require.NotEmpty(t, definition.GroupByURL)

	builtin := getAdultFilmIndexScraper(mockGlobalConfig{})
	require.Equal(t, AdultFilmIndexScraperID, builtin.spec().ID)
	require.NotNil(t, builtin.spec().Group)
}

func TestAdultFilmIndexGroupSearchExtractsMovieResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<article class="media box movie">
<div class="media-content"><h4 class="title is-4"><a href="https://www.adultfilmindex.com/movie/676/squirt-queens-6">Squirt Queens 6</a></h4>
<h5 class="subtitle is-6"> 2006 | <a href="/studio/2519/white-ghetto-films">White Ghetto Films</a> | Runtime: 2h 0min | Series: <span class="js-link">Squirt Queens</span></h5></div>
</article>
<article class="media box movie">
<figure class="media-left"><a href="https://www.adultfilmindex.com/movie/677/squirt-queens-7"><img src="https://cdn.adultfilmindex.com/storage/movies/677/677_front.jpg" /></a></figure>
<div class="media-content"><h4 class="title is-4"><a href="https://www.adultfilmindex.com/movie/677/squirt-queens-7">Squirt Queens 7</a></h4>
<h5 class="subtitle is-6"> 2007 | <a href="/studio/2519/white-ghetto-films">White Ghetto Films</a> | Runtime: 1h 30min | Series: <span class="js-link">Squirt Queens</span></h5></div>
</article>`))
	}))
	defer server.Close()

	data, err := os.ReadFile(filepath.Join("..", "..", "scrapers", "AdultFilmIndex.yml"))
	require.NoError(t, err)
	definition, err := loadConfigFromYAML("adultfilmindex", bytes.NewReader(data))
	require.NoError(t, err)
	definition.DriverOptions = nil
	definition.GroupByName.QueryURL = server.URL + "/movie?q={}"

	s := scraperFromDefinition(*definition, mockGlobalConfig{})
	content, err := s.viaName(context.Background(), &http.Client{}, "Squirt Queens 6", ScrapeContentTypeGroup)
	require.NoError(t, err)
	require.Len(t, content, 2)
	group, ok := content[0].(*models.ScrapedGroup)
	require.True(t, ok)
	require.Equal(t, "Squirt Queens 6", *group.Name)
	require.Equal(t, "2006", *group.Date)
	require.Equal(t, "2h 0min", *group.Duration)
	require.Equal(t, "Squirt Queens", *group.ContainingGroup)
	require.NotNil(t, group.FrontImage)
	require.Empty(t, *group.FrontImage)
	require.Equal(t, []string{"https://www.adultfilmindex.com/movie/676/squirt-queens-6"}, group.URLs)
	require.NotNil(t, group.Studio)
	require.Equal(t, "White Ghetto Films", group.Studio.Name)
	second := content[1].(*models.ScrapedGroup)
	require.Equal(t, "1h 30min", *second.Duration)
	require.NotNil(t, second.Studio)
	require.Equal(t, "White Ghetto Films", second.Studio.Name)
	require.Equal(t, []string{"https://www.adultfilmindex.com/movie/677/squirt-queens-7"}, second.URLs)
	require.Equal(t, "https://cdn.adultfilmindex.com/storage/movies/677/677_front.jpg", *second.FrontImage)
}

func TestAdultFilmIndexGroupPageExtractsDetails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><head>
<link rel="canonical" href="https://www.adultfilmindex.com/movie/676/squirt-queens-6">
<meta property="og:image" content="https://cdn.adultfilmindex.com/storage/movies/676/676_front.jpg">
</head><body>
<h1 class="title is-2">Squirt Queens 6</h1>
<h2 class="subtitle is-5">2006 | <a href="/studio/2519/white-ghetto-films">White Ghetto Films</a>, <a href="/studio/174/devils-film">Devil's Film</a> | Runtime: 2h 0min | Series: Squirt Queens</h2>
<p class="content"><strong>Description:</strong> A detailed description.</p>
<a data-target="modal-back-cover" href="https://cdn.adultfilmindex.com/storage/movies/676/676_back.jpg">Back Cover</a>
<h3>More info:</h3><ul><li><a href="https://www.bang.com/movie/676">BANG!</a></li><li><a href="https://www.iafd.com/title.rme/id=676">IAFD</a></li></ul>
</body></html>`))
	}))
	defer server.Close()

	data, err := os.ReadFile(filepath.Join("..", "..", "scrapers", "AdultFilmIndex.yml"))
	require.NoError(t, err)
	definition, err := loadConfigFromYAML("adultfilmindex", bytes.NewReader(data))
	require.NoError(t, err)
	definition.DriverOptions = nil
	definition.GroupByFragment.QueryURL = server.URL + "{url}"

	s := scraperFromDefinition(*definition, mockGlobalConfig{})
	content, err := s.viaFragment(context.Background(), &http.Client{}, Input{
		Group: &ScrapedGroupInput{URLs: []string{"/movie/676"}},
	})
	require.NoError(t, err)
	group, ok := content.(*models.ScrapedGroup)
	require.True(t, ok)
	require.Equal(t, "A detailed description.", *group.Synopsis)
	require.Equal(t, "Squirt Queens", *group.ContainingGroup)
	require.Equal(t, "https://cdn.adultfilmindex.com/storage/movies/676/676_front.jpg", *group.FrontImage)
	require.Equal(t, "https://cdn.adultfilmindex.com/storage/movies/676/676_back.jpg", *group.BackImage)
	require.Equal(t, []string{
		"https://www.adultfilmindex.com/movie/676/squirt-queens-6",
		"https://www.bang.com/movie/676",
		"https://www.iafd.com/title.rme/id=676",
	}, group.URLs)
}
