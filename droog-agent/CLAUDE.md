# Droog Chatbot — Claude Code Guide

## Project overview

This is a WordPress plugin for the [Droog](https://droog.io) SaaS chatbot platform. Droog is a multi-tenant RAG (Retrieval-Augmented Generation) chatbot service. Each tenant creates bots on the Droog dashboard; each bot gets a unique `web_chat_widget_id`.

The plugin is intentionally minimal. Its only job is to:

1. Let a WordPress site admin store their Droog Bot Widget ID (and cosmetic preferences) in the database.
2. Inject the correct `<script>` tag into every page's `<footer>` so the Droog widget loads.

Do not add features beyond this scope without a clear product requirement.

---

## Architecture decisions

### Why `bot_widget_id` is stored instead of raw script HTML

Allowing admins to paste arbitrary `<script>` HTML would create a stored-XSS vector — any JavaScript could be injected. Instead, the plugin stores only the widget ID (a plain alphanumeric string), validates it against `/^[a-zA-Z0-9_-]+$/`, and constructs the `<script>` tag in PHP. This means the CDN URL and attribute names are static, and user-controlled data only ever lands in `esc_attr()`-escaped HTML attributes.

### Why `wp_footer` echo is used instead of `wp_enqueue_script`

`wp_enqueue_script` does not support arbitrary HTML attributes like `data-bot-id` or `data-position` on the `<script>` tag without brittle filters (`script_loader_tag`). Echoing directly in `wp_footer` at priority 99 is simpler, fully supported, and avoids a WordPress quirk where the registered handle can collide with or de-duplicate external scripts.

### Single serialized option vs multiple `get_option` calls

All settings are stored as one serialized array under `droog_chatbot_settings`. This means one database read per page load (or one autoloaded option hit) instead of four. For a plugin this size it also keeps the options table clean.

---

## WordPress coding standards

- All PHP files **must** begin with `if ( ! defined( 'ABSPATH' ) ) exit;`
- Use WP nonces for every form submission (`wp_nonce_field` + `check_admin_referer`)
- Escape **all** output:
  - HTML attributes → `esc_attr()`
  - Plain text → `esc_html()` / `esc_html_e()`
  - URLs → `esc_url()`
- Prefix all functions, classes, constants, and option names with `droog_` or `Droog_`
- No inline styles in PHP — use the enqueued `assets/css/admin.css`
- Admin CSS **must** be scoped to `#droog-chatbot-settings` to avoid global bleed

---

## File responsibilities

| File | Purpose |
|------|---------|
| `droog-chatbot.php` | Plugin bootstrap: defines constants, requires classes, fires init |
| `includes/class-droog-admin.php` | Registers admin menu, settings fields, sanitization, and asset enqueue |
| `includes/class-droog-widget.php` | Hooks into `wp_footer` and outputs the widget `<script>` tag |
| `admin/views/settings-page.php` | HTML template for the settings form (rendered by `Droog_Admin`) |
| `assets/css/admin.css` | Styles scoped to the plugin settings page |
| `languages/droog-chatbot.pot` | i18n POT template — run `wp i18n make-pot . languages/` to regenerate |
| `uninstall.php` | Deletes `droog_chatbot_settings` when the plugin is deleted |
| `readme.txt` | WordPress.org plugin directory listing |
| `CHANGELOG.md` | Human-readable release notes |

---

## Testing checklist

### LocalWP setup

1. Install [LocalWP](https://localwp.com/) and create a new WordPress site.
2. Copy the `droog-chatbot` folder into `app/public/wp-content/plugins/`.
3. Open WP Admin and activate **Droog Chatbot** under Plugins.

### Functional checklist

- [ ] Activate plugin — no PHP errors or warnings in debug log.
- [ ] Navigate to **Droog Chatbot** settings page — page renders correctly.
- [ ] Enter a valid Bot Widget ID (e.g. `bot-id-fac108d412c4`) and save — success notice appears.
- [ ] View source on the frontend — confirm `<script ... data-bot-id="bot-id-fac108d412c4" ...>` is present in `<body>` before `</body>`.
- [ ] Open browser DevTools console — confirm no JS errors related to the widget script.
- [ ] **Empty widget ID:** Clear the Bot Widget ID field and save. View source — confirm the `<script>` tag is **not** injected.
- [ ] **Invalid widget ID format:** Enter `<script>alert(1)</script>` as widget ID — confirm validation error is shown and the bad value is not stored.
- [ ] **Color picker:** Change primary color, save, view source — confirm `data-primary-color` attribute reflects new value.
- [ ] **Position toggle:** Switch to `bottom-left`, save, view source — confirm `data-position="bottom-left"`.
- [ ] **Enable checkbox unchecked:** Uncheck "Enable on All Pages", save — confirm widget script is **not** injected on frontend.
- [ ] **Uninstall:** Deactivate then delete the plugin. Open WP Admin > Tools > Site Health > Info > Database — confirm `droog_chatbot_settings` option no longer exists.

---

## Known limitations and future work

- **No per-page targeting in v1** — the widget is either on all pages or off. Future: meta box or shortcode to include/exclude individual posts/pages.
- **No Gutenberg block in v1** — a block for placing the widget trigger inline is planned.
- **CDN URL is hardcoded** — `https://cdn.droog.io/widget/droog-widget.js` is set directly in `class-droog-widget.php`. It will become a filtered constant (or admin setting) in v2 once the CDN is stable.
- **Multisite not tested** — the plugin stores options at the blog level. Network-wide settings are not supported in v1.
- **No per-bot analytics integration** — click/session data from the widget is handled entirely by the Droog platform, not this plugin.
