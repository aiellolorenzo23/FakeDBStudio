# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, adapted to the current needs of this project.

## [1.0.0] - 2026-06-08

### Added

- Initial public release of FakeDB Studio as a desktop application for working with FakeDB databases.
- Database structure editor with support for column creation, renaming, and deletion.
- Initial query support, including `SELECT *`, selection of specific columns, and basic `WHERE` clauses.
- Fast table search and filtering.
- Column sorting.
- Recent files support.
- Automatic reopening of the last opened database.
- Query history.
- Windows portable release artifact alongside the standard Windows setup installer.

### Changed

- General UX improvements across dialogs, context menus, and unsaved changes handling.
- Internal refactoring for a more modular and maintainable application structure.

### Notes

- Windows, macOS, and Linux packages are produced through Electron Builder.
- Linux release assets are distributed as `AppImage` and `deb` packages.
