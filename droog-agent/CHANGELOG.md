# Changelog

All notable changes to Droog Chatbot will be documented in this file.

## [1.0.0] — 2024-01-01

### Added
- Settings page under **Droog Chatbot** in the WordPress admin menu.
- **Bot Widget ID** field — stores the widget ID from the Droog dashboard.
- **Primary Color** color picker — customizes the widget accent color (default: `#6366f1`).
- **Launcher Position** select — choose `bottom-right` (default) or `bottom-left`.
- **Enable on All Pages** checkbox — toggle widget injection site-wide.
- Server-side `<script>` tag construction with `esc_attr()` output escaping on all values.
- Async widget script injection via `wp_footer` at priority 99.
- Input sanitization: widget ID regex validation, hex color validation, position enum check.
- WP nonce protection on all settings form submissions.
- `uninstall.php` — cleans up `droog_chatbot_settings` option on plugin deletion.
- i18n-ready: all strings wrapped in `__()` / `esc_html_e()` with `droog-chatbot` text domain.
- Scoped admin CSS via `#droog-chatbot-settings` wrapper.
