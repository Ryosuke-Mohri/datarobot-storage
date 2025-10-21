# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-10-21

### Added

- Improved table paddings
- Display file preview size relative to actual size
- Added file upload indication
- Added additional session invalidation logic
- Implemented suggested prompts when KB/files are selected
- Added validation messages to KB/chat actions
- Switched message retrieval to SSE (server-sent events) instead of polling
- Updated app navigation to highlight the active page correctly
- Visual updates for links and knowledge bases
- Upgraded DataRobot integration to use Core

### Fixed

- Fixed markdown response rendering for 4o mini and added animation
- Disabled “Create KB” button when required fields are missing
- Fixed fast refresh issues and updated exports
- Fixed button text alignment and consistency
- Fixed table paddings

## [0.2.0] - 2025-09-25

### Added

- Initial release of Talk to My Docs.
- Storing uploaded files in persistent storage. Files will not be lost between container restarts.
- User sees only own chats.
- Added support of DB migrations with [Alembic](https://alembic.sqlalchemy.org/en/latest/).
