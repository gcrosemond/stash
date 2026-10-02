package scraper

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/antchfx/htmlquery"

	"golang.org/x/net/html"

	"github.com/stashapp/stash/pkg/logger"
	"github.com/stashapp/stash/pkg/models"
)

type xpathScraper struct {
	definition   Definition
	globalConfig GlobalConfig
	client       *http.Client
}

func (s *xpathScraper) getXpathScraper(name string) (*mappedScraper, error) {
	ret, ok := s.definition.XPathScrapers[name]
	if !ok {
		return nil, fmt.Errorf("xpath scraper with name %s not found in config", name)
	}
	return &ret, nil
}

type xpathURLScraper struct {
	xpathScraper
	definition ByURLDefinition
}

func (s *xpathURLScraper) scrapeByURL(ctx context.Context, url string, ty ScrapeContentType) (ScrapedContent, error) {
	scraper, err := s.getXpathScraper(s.definition.Scraper)
	if err != nil {
		return nil, err
	}

	doc, err := s.loadURL(ctx, url)
	if err != nil {
		return nil, err
	}

	q := s.getXPathQuery(doc, url)
	// if these just return the return values from scraper.scrape* functions then
	// it ends up returning ScrapedContent(nil) rather than nil
	switch ty {
	case ScrapeContentTypePerformer:
		ret, err := scraper.scrapePerformer(ctx, q)
		if err != nil || ret == nil {
			return nil, err
		}
		return ret, nil
	case ScrapeContentTypeScene:
		ret, err := scraper.scrapeScene(ctx, q)
		if err != nil || ret == nil {
			return nil, err
		}
		return ret, nil
	case ScrapeContentTypeGallery:
		ret, err := scraper.scrapeGallery(ctx, q)
		if err != nil || ret == nil {
			return nil, err
		}
		return ret, nil
	case ScrapeContentTypeImage:
		ret, err := scraper.scrapeImage(ctx, q)
		if err != nil || ret == nil {
			return nil, err
		}
		return ret, nil
	case ScrapeContentTypeMovie, ScrapeContentTypeGroup:
		ret, err := scraper.scrapeGroup(ctx, q)
		if err != nil || ret == nil {
			return nil, err
		}
		return ret, nil
	}

	return nil, ErrNotSupported
}

type xpathNameScraper struct {
	xpathScraper
	definition ByNameDefinition
}

func (s *xpathNameScraper) scrapeByName(ctx context.Context, name string, ty ScrapeContentType) ([]ScrapedContent, error) {
	scraper, err := s.getXpathScraper(s.definition.Scraper)
	if err != nil {
		return nil, err
	}

	const placeholder = "{}"

	// replace the placeholder string with the URL-escaped name
	escapedName := url.QueryEscape(name)

	url := s.definition.QueryURL
	url = strings.ReplaceAll(url, placeholder, escapedName)
	logger.Debugf("XPath scraper name search: scraper=%s type=%s name=%q url=%s", s.definition.Scraper, ty, name, url)

	doc, err := s.loadURL(ctx, url)

	if err != nil {
		return nil, err
	}

	q := s.getXPathQuery(doc, url)
	q.setType(SearchQuery)
	pageTitle, challenge := xpathDocumentDebugInfo(doc)
	logger.Debugf("XPath scraper name search page: scraper=%s title=%q challenge=%t", s.definition.Scraper, pageTitle, challenge)

	var content []ScrapedContent
	switch ty {
	case ScrapeContentTypePerformer:
		performers, err := scraper.scrapePerformers(ctx, q)
		if err != nil {
			return nil, err
		}
		for _, p := range performers {
			content = append(content, p)
		}

		return content, nil
	case ScrapeContentTypeGroup:
		groups, err := scraper.scrapeGroups(ctx, q)
		if err != nil {
			logger.Debugf("XPath scraper group search failed: scraper=%s url=%s error=%v", s.definition.Scraper, url, err)
			return nil, err
		}
		logger.Debugf("XPath scraper group search extracted %d results: scraper=%s url=%s", len(groups), s.definition.Scraper, url)
		for _, g := range groups {
			content = append(content, g)
		}
		return content, nil
	case ScrapeContentTypeScene:
		scenes, err := scraper.scrapeScenes(ctx, q)
		if err != nil {
			return nil, err
		}
		for _, s := range scenes {
			content = append(content, s)
		}

		return content, nil
	}

	return nil, ErrNotSupported
}

type xpathFragmentScraper struct {
	xpathScraper
	definition ByFragmentDefinition
}

func (s *xpathFragmentScraper) scrapeSceneByScene(ctx context.Context, scene *models.Scene) (*models.ScrapedScene, error) {
	// construct the URL
	queryURL := queryURLParametersFromScene(scene)
	if s.definition.QueryURLReplacements != nil {
		queryURL.applyReplacements(s.definition.QueryURLReplacements)
	}
	url := queryURL.constructURL(s.definition.QueryURL)

	scraper, err := s.getXpathScraper(s.definition.Scraper)
	if err != nil {
		return nil, err
	}

	doc, err := s.loadURL(ctx, url)

	if err != nil {
		return nil, err
	}

	q := s.getXPathQuery(doc, url)
	return scraper.scrapeScene(ctx, q)
}

func (s *xpathFragmentScraper) scrapeByFragment(ctx context.Context, input Input) (ScrapedContent, error) {
	switch {
	case input.Gallery != nil:
		return nil, fmt.Errorf("%w: cannot use an xpath scraper as a gallery fragment scraper", ErrNotSupported)
	case input.Performer != nil:
		return nil, fmt.Errorf("%w: cannot use an xpath scraper as a performer fragment scraper", ErrNotSupported)
	case input.Group != nil:
		group := *input.Group
		queryURL := queryURLParametersFromScrapedGroup(group)
		if s.definition.QueryURLReplacements != nil {
			queryURL.applyReplacements(s.definition.QueryURLReplacements)
		}
		url := queryURL.constructURL(s.definition.QueryURL)
		scraper, err := s.getXpathScraper(s.definition.Scraper)
		if err != nil {
			return nil, err
		}
		doc, err := s.loadURL(ctx, url)
		if err != nil {
			return nil, err
		}
		return scraper.scrapeGroup(ctx, s.getXPathQuery(doc, url))
	case input.Scene == nil:
		return nil, fmt.Errorf("%w: scene input is nil", ErrNotSupported)
	}

	scene := *input.Scene

	// construct the URL
	queryURL := queryURLParametersFromScrapedScene(scene)
	if s.definition.QueryURLReplacements != nil {
		queryURL.applyReplacements(s.definition.QueryURLReplacements)
	}
	url := queryURL.constructURL(s.definition.QueryURL)

	scraper, err := s.getXpathScraper(s.definition.Scraper)
	if err != nil {
		return nil, err
	}

	doc, err := s.loadURL(ctx, url)

	if err != nil {
		return nil, err
	}

	q := s.getXPathQuery(doc, url)
	return scraper.scrapeScene(ctx, q)
}

func (s *xpathFragmentScraper) scrapeGalleryByGallery(ctx context.Context, gallery *models.Gallery) (*models.ScrapedGallery, error) {
	// construct the URL
	queryURL := queryURLParametersFromGallery(gallery)
	if s.definition.QueryURLReplacements != nil {
		queryURL.applyReplacements(s.definition.QueryURLReplacements)
	}
	url := queryURL.constructURL(s.definition.QueryURL)

	scraper, err := s.getXpathScraper(s.definition.Scraper)
	if err != nil {
		return nil, err
	}

	doc, err := s.loadURL(ctx, url)

	if err != nil {
		return nil, err
	}

	q := s.getXPathQuery(doc, url)
	return scraper.scrapeGallery(ctx, q)
}

func (s *xpathFragmentScraper) scrapeImageByImage(ctx context.Context, image *models.Image) (*models.ScrapedImage, error) {
	// construct the URL
	queryURL := queryURLParametersFromImage(image)
	if s.definition.QueryURLReplacements != nil {
		queryURL.applyReplacements(s.definition.QueryURLReplacements)
	}
	url := queryURL.constructURL(s.definition.QueryURL)

	scraper, err := s.getXpathScraper(s.definition.Scraper)
	if err != nil {
		return nil, err
	}

	doc, err := s.loadURL(ctx, url)

	if err != nil {
		return nil, err
	}

	q := s.getXPathQuery(doc, url)
	return scraper.scrapeImage(ctx, q)
}

func (s *xpathScraper) loadURL(ctx context.Context, url string) (*html.Node, error) {
	logger.Debugf("XPath scraper loading URL: %s", url)
	r, err := loadURL(ctx, url, s.client, s.definition, s.globalConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to load URL %q: %w", url, err)
	}

	ret, err := html.Parse(r)
	if err == nil {
		logger.TraceFunc(func() (string, []interface{}) {
			var b bytes.Buffer
			if renderErr := html.Render(&b, ret); renderErr != nil {
				return "XPath scraper response diagnostics: url=%s render error=%v", []interface{}{url, renderErr}
			}

			const previewLimit = 512
			preview := b.String()
			if len(preview) > previewLimit {
				preview = preview[:previewLimit] + "..."
			}
			preview = strings.ReplaceAll(preview, "\n", " ")
			title, challenge := xpathDocumentDebugInfo(ret)
			return "XPath scraper response diagnostics: url=%s bytes=%d title=%q challenge=%t preview=%q", []interface{}{url, b.Len(), title, challenge, preview}
		})
	}

	if err == nil && s.definition.DebugOptions != nil && s.definition.DebugOptions.PrintHTML {
		var b bytes.Buffer
		if err := html.Render(&b, ret); err != nil {
			logger.Warnf("could not render HTML: %v", err)
		}
		logger.Infof("loadURL (%s) response: \n%s", url, b.String())
	}

	return ret, err
}

func xpathDocumentDebugInfo(doc *html.Node) (string, bool) {
	if doc == nil {
		return "", false
	}

	q := &xpathQuery{doc: doc}
	title := ""
	if nodes, err := htmlquery.QueryAll(doc, "//title"); err == nil && len(nodes) > 0 {
		title = q.nodeText(nodes[0])
	}

	challenge := strings.Contains(strings.ToLower(title), "just a moment")
	if !challenge {
		if nodes, err := htmlquery.QueryAll(doc, "//*[contains(@id, 'challenge-error') or contains(@class, 'cf-chl')]"); err == nil {
			challenge = len(nodes) > 0
		}
	}

	return title, challenge
}

func (s *xpathScraper) getXPathQuery(doc *html.Node, url string) *xpathQuery {
	return &xpathQuery{
		doc:     doc,
		scraper: s,
		url:     url,
	}
}

var (
	multiSpaceRE = regexp.MustCompile("  +")
	newlineRE    = regexp.MustCompile("\n")
)

type xpathQuery struct {
	doc       *html.Node
	scraper   *xpathScraper
	queryType QueryType
	url       string
}

func (q *xpathQuery) getType() QueryType {
	return q.queryType
}

func (q *xpathQuery) setType(t QueryType) {
	q.queryType = t
}

func (q *xpathQuery) getURL() string {
	return q.url
}

func (q *xpathQuery) runQuery(selector string) ([]string, error) {
	found, err := htmlquery.QueryAll(q.doc, selector)
	if err != nil {
		return nil, fmt.Errorf("selector '%s': parse error: %v", selector, err)
	}

	var ret []string
	for _, n := range found {
		nodeText := q.nodeText(n)
		// Search results are assembled by index across fields. Preserve empty
		// values there so an optional field does not shift later results.
		if nodeText != "" || q.getType() == SearchQuery {
			ret = append(ret, q.nodeText(n))
		}
	}
	logger.Tracef("XPath query: url=%s selector=%q nodes=%d values=%d", q.url, selector, len(found), len(ret))

	return ret, nil
}

func (q *xpathQuery) nodeText(n *html.Node) string {
	var ret string
	if n != nil && n.Type == html.CommentNode {
		ret = htmlquery.OutputHTML(n, true)
	} else {
		ret = htmlquery.InnerText(n)
	}

	// trim all leading and trailing whitespace
	ret = strings.TrimSpace(ret)

	// remove multiple whitespace
	ret = multiSpaceRE.ReplaceAllString(ret, " ")

	// TODO - make this optional
	ret = newlineRE.ReplaceAllString(ret, "")

	return ret
}

func (q *xpathQuery) runQueryAttribute(selector string, attribute string) ([]string, error) {
	found, err := htmlquery.QueryAll(q.doc, selector)
	if err != nil {
		return nil, fmt.Errorf("selector '%s': parse error: %v", selector, err)
	}

	ret := make([]string, 0, len(found))
	for _, n := range found {
		value := descendantAttribute(n, attribute)
		if value != "" || q.getType() == SearchQuery {
			ret = append(ret, value)
		}
	}
	logger.Tracef("XPath attribute query: url=%s selector=%q attribute=%q nodes=%d values=%d", q.url, selector, attribute, len(found), len(ret))

	return ret, nil
}

func descendantAttribute(n *html.Node, key string) string {
	if n == nil {
		return ""
	}

	if n.Type == html.ElementNode {
		for _, attr := range n.Attr {
			if attr.Key == key {
				return attr.Val
			}
		}
	}

	for child := n.FirstChild; child != nil; child = child.NextSibling {
		if value := descendantAttribute(child, key); value != "" {
			return value
		}
	}

	return ""
}

func (q *xpathQuery) subScrape(ctx context.Context, value string) mappedQuery {
	doc, err := q.scraper.loadURL(ctx, value)

	if err != nil {
		logger.Warnf("Error getting URL '%s' for sub-scraper: %s", value, err.Error())
		return nil
	}

	return q.scraper.getXPathQuery(doc, value)
}
