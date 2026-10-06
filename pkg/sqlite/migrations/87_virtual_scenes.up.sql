ALTER TABLE `scenes` ADD COLUMN `type` varchar(16) NOT NULL DEFAULT 'NORMAL';
ALTER TABLE `scenes` ADD COLUMN `source_scene_id` integer;
ALTER TABLE `scenes` ADD COLUMN `start_seconds` float;
ALTER TABLE `scenes` ADD COLUMN `end_seconds` float;
ALTER TABLE `scenes` ADD COLUMN `cover_seconds` float;

CREATE INDEX `index_scenes_on_type` ON `scenes` (`type`);
CREATE INDEX `index_scenes_on_source_scene_id` ON `scenes` (`source_scene_id`);

CREATE TABLE `scenes_fingerprints` (
  `scene_id` integer NOT NULL,
  `type` varchar(255) NOT NULL,
  `fingerprint` blob NOT NULL,
  FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`scene_id`, `type`)
);

CREATE INDEX `index_scene_fingerprint_type_fingerprint`
  ON `scenes_fingerprints` (`type`, `fingerprint`);

CREATE TABLE `scene_ignored_ranges` (
  `id` integer PRIMARY KEY,
  `scene_id` integer NOT NULL,
  `start_seconds` float NOT NULL,
  `end_seconds` float NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE
);

CREATE INDEX `index_scene_ignored_ranges_on_scene_id`
  ON `scene_ignored_ranges` (`scene_id`);
