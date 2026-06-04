=== Droog Agent ===
Contributors: droogtech
Author: Droog Technologies Private Limited
Author URI: https://droog.io
Tags: ai agent, conversational ai, droog, rag, intelligent assistant
Requires at least: 5.8
Tested up to: 7.0
Stable tag: 1.0.0
Version: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

The future of Conversational Intelligence — add your Droog AI agent to any WordPress site in minutes. No coding required.

== Description ==

**Droog Agent** connects your WordPress site to the [Droog](https://droog.io) platform — a Retrieval-Augmented Generation (RAG) conversational intelligence SaaS that lets you build, train, and deploy intelligent agents trained on your own content.

Upload your documents or web URLs to a knowledge base, publish your assistant, and embed it on your site — all without writing a single line of code.

This plugin handles the embed step for you: it securely stores your Droog credentials and injects the assistant widget into your WordPress site's footer automatically.

**How it works:**

1. Sign up at [app.droog.io](https://app.droog.io) — accounts start on a free Trial plan.
2. Click **Create Agent** and configure your assistant's identity, voice, and knowledge base.
3. Upload your content (PDF, DOCX, Word, web URLs, sitemaps) and wait for indexing to complete.
4. Click **Publish**, then open the **Deploy** tab to retrieve your **Tenant ID** and **Agent ID**.
5. Paste both IDs into this plugin's settings page — your assistant appears on every page instantly.

For a step-by-step walkthrough see the [Droog Quickstart Guide](https://documentation.droog.io/quickstart#registration).

**Features:**

* Two-field setup — paste your Tenant ID and Agent ID from the Droog Deploy tab.
* Set a custom display name shown in the assistant's chat header.
* Three launcher positions: **Bottom Right**, **Bottom Left**, or **Google-Centered** (inline search bar).
* Add animated typewriter prompts to the Google-Centered search bar.
* Full color customisation: accent color, header background, header text, and input area background.
* Toggle the widget on or off across your entire site with one checkbox.
* Use the `[droog_search_bar]` shortcode to place an inline search bar anywhere on a page (requires Google-Centered position mode).
* Zero performance overhead — the widget script loads asynchronously.
* Security-first: only your Tenant ID and Agent ID are stored; the `<script>` tag is constructed server-side using `esc_attr()`.

== Installation ==

1. Upload the `droog-agent` folder to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress Admin.
3. Go to **Droog Agent** in the left-hand admin menu.
4. Enter your **Tenant ID** and **Agent ID** (see FAQ below for where to find these).
5. Click **Save Settings** — your assistant is now live on the frontend.

== Frequently Asked Questions ==

= Where do I find my Tenant ID and Agent ID? =

Log in to [app.droog.io](https://app.droog.io), open your published assistant, and go to the **Settings** tab.

Your embed snippet will look like this:

`<script src="https://api.droog.io/embed/YOUR-TENANT-ID/YOUR-AGENT-ID.js"></script>`

* **Tenant ID** — the long UUID segment in the URL (e.g. `4e47xxxx-fexx-44xx-90xx-xxxxxxxedb88`)
* **Agent ID** — the identifier after the slash (e.g. `bot-id-fac10xxxxxxx`)

Copy each value separately and paste them into the corresponding fields on the plugin settings page.

= Do I need a Droog account? =

Yes. Create a free account at [app.droog.io](https://app.droog.io). New accounts start on a Trial plan. See the [Droog Quickstart Guide](https://documentation.droog.io/quickstart#registration) for full onboarding steps.

= What content can I add to my assistant's knowledge base? =

Droog supports PDF, DOCX, TXT, Markdown, HTML, web URLs, and sitemaps. After uploading, wait for all documents to show a `completed` status before publishing.

= What is the Google-Centered position mode? =

This mode replaces the floating launcher with an inline search bar that mounts inside any element you place the `[droog_search_bar]` shortcode in. It also supports animated typewriter prompts. Ideal for landing pages or search-first layouts.

= Will this slow down my site? =

No. The widget script is loaded with the `async` attribute, so it never blocks page rendering.

= Can I show the widget only on certain pages? =

Per-page targeting is not available in v1.0. The widget is either shown on all pages or disabled entirely. Granular page targeting is planned for a future release.

= How do I hide the widget without deleting my settings? =

Uncheck **Enable on All Pages** on the settings page and save. The script will not be injected until you re-enable it.

== Screenshots ==

1. The Droog Agent settings page — enter your Tenant ID, Agent ID, display name, and appearance options.
2. The floating assistant launcher in the bottom-right corner of a live site.
3. The assistant chat panel open, showing a conversation with RAG-powered answers and source citations.
4. Google-Centered mode — an inline search bar with animated typewriter prompts embedded in a page via the `[droog_search_bar]` shortcode.

== Changelog ==

= 1.0.0 =
* Initial release.
* Settings page with Tenant ID, Agent ID, assistant display name, launcher position, animated prompts, and enable/disable toggle.
* Full appearance customisation: accent color, header background, header text color, and input area background.
* Three launcher positions: bottom-right, bottom-left, and google-centered.
* `[droog_search_bar]` shortcode for inline search bar placement in google-centered mode.
* Secure server-side script tag construction using `esc_attr()`.
* Async widget script injection via `wp_footer` at priority 99.

== Upgrade Notice ==
All upgrade are managed my droogtech

== Reviews ==

If you find Droog Agent useful, please consider leaving a review on the [WordPress.org plugin page](https://wordpress.org/support/plugin/droog-agent/reviews/#new-post). Your feedback helps us improve the plugin and lets other site owners discover it.

We read every review and respond to questions and issues — your experience matters to us.
