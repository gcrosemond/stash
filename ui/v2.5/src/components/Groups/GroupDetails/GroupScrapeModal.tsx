import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Form, InputGroup } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { ModalComponent } from "src/components/Shared/Modal";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { useScrapeGroupList } from "src/core/StashService";
import { useDebounce } from "src/hooks/debounce";
import { useToast } from "src/hooks/Toast";

interface IProps {
  scraper: GQL.Scraper;
  name?: string;
  onHide: () => void;
  onSelectGroup: (group: GQL.ScrapedGroup, scraper: GQL.Scraper) => void;
}

export const GroupScrapeModal: React.FC<IProps> = ({
  scraper,
  name,
  onHide,
  onSelectGroup,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState(name ?? "");
  const [query, setQuery] = useState(name ?? "");
  const { data, loading, error, refetch } = useScrapeGroupList(
    scraper.id,
    query
  );
  const onInputChange = useDebounce(setQuery, 500);
  const Toast = useToast();

  function search() {
    setQuery(searchText.trim());
  }

  async function retry() {
    try {
      await refetch();
    } catch (e) {
      Toast.error(e);
    }
  }

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <ModalComponent
      show
      onHide={onHide}
      header={`Scrape group from ${scraper.name}`}
      accept={{ text: "Cancel", onClick: onHide, variant: "secondary" }}
    >
      <InputGroup className="mb-4">
        <Form.Control
          ref={inputRef}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.currentTarget.value);
            onInputChange(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
          placeholder="Group name..."
          className="text-input"
        />
        <InputGroup.Append>
          <Button disabled={!searchText.trim() || loading} onClick={search}>
            Search
          </Button>
        </InputGroup.Append>
      </InputGroup>
      {loading ? (
        <div className="m-4 text-center">
          <LoadingIndicator inline />
        </div>
      ) : error ? (
        <Alert variant="danger">
          <div>{error.message}</div>
          <Button variant="outline-danger" className="mt-2" onClick={retry}>
            Retry
          </Button>
        </Alert>
      ) : (
        <ul className="GroupScrapeModal-list">
          {(data?.scrapeSingleGroup ?? []).map((group, index) => (
            <li
              key={`${group.name}-${index}`}
              className="d-flex align-items-start mb-3"
            >
              {group.front_image ? (
                <img
                  src={group.front_image}
                  alt=""
                  className="mr-3"
                  style={{ width: 72, height: 96, objectFit: "cover" }}
                />
              ) : null}
              <div>
                <Button
                  variant="link"
                  onClick={() => onSelectGroup(group, scraper)}
                >
                  {group.name}
                </Button>
                <div className="small text-muted">
                  {[group.date, group.studio?.name, group.duration]
                    .filter(Boolean)
                    .join(" | ")}
                </div>
                {group.containing_group ? (
                  <div className="small text-muted">
                    Containing Group: {group.containing_group}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
          {query && data?.scrapeSingleGroup?.length === 0 ? (
            <li className="list-unstyled">
              <Alert variant="info" className="mb-0">
                No group results found.
                <Button variant="link" className="p-0 ml-2" onClick={retry}>
                  Retry
                </Button>
              </Alert>
            </li>
          ) : null}
        </ul>
      )}
    </ModalComponent>
  );
};
