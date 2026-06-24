import unittest

from print_newly_resolved_issues_from_changelog import (
    extract_newest_issues,
    link_youtrack_issues,
)
from send_changelog_to_discord import build_payload, parse_latest_release


SAMPLE_CHANGELOG = """# CHANGELOG.md

All notable changes to this project will be documented in this file.

[2.0.2] (released on 2026-06-25)
* JW-456: Link Discord notification to release artifacts
* JW-457: Link release-note issues to YouTrack

[2.0.1] (released on 2026-06-24)
* JW-451: Previous issue
"""


class ReleaseNotesTests(unittest.TestCase):
    def test_newest_issues_keep_bullet_structure_and_link_issue_ids(self):
        newest_issues = extract_newest_issues(SAMPLE_CHANGELOG)

        self.assertEqual(
            link_youtrack_issues(newest_issues),
            "* [JW-456](https://javawiz.youtrack.cloud/issue/JW-456): "
            "Link Discord notification to release artifacts\n"
            "* [JW-457](https://javawiz.youtrack.cloud/issue/JW-457): "
            "Link release-note issues to YouTrack",
        )

    def test_non_issue_lines_are_preserved(self):
        notes = "* JW-456: Issue\nAdditional information"

        self.assertEqual(
            link_youtrack_issues(notes),
            "* [JW-456](https://javawiz.youtrack.cloud/issue/JW-456): Issue\n"
            "Additional information",
        )


class DiscordReleaseNotificationTests(unittest.TestCase):
    def test_payload_links_to_the_versioned_github_release(self):
        version, release_date, _, issue_count = parse_latest_release(
            SAMPLE_CHANGELOG)

        payload = build_payload(version, release_date, issue_count)
        embed = payload["embeds"][0]
        release_url = (
            "https://github.com/SSW-JKU/javawiz/releases/tag/v2.0.2")

        self.assertEqual(embed["url"], release_url)
        self.assertIn(f"[Download release artifacts]({release_url})",
                      embed["description"])
        self.assertEqual(
            embed["fields"][0]["name"],
            "Issues resolved in this version: 2",
        )


if __name__ == "__main__":
    unittest.main()
