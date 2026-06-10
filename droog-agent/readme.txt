=== Droog Agent ===
Contributors: droogtech
Author: Droog Technologies Private Limited
Author URI: https://droog.io
Tags: ai chatbot, chatbot, live chat, ai assistant, customer support
Requires at least: 5.8
Tested up to: 7.0
Stable tag: 1.0.0
Version: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add an AI-powered chat assistant to your WordPress site in minutes. No coding required.

== Description ==

**Droog Agent** lets you add a smart AI chat assistant to your WordPress site — one that actually knows your business, answers visitor questions, and works around the clock.

You train the assistant on your own content (documents, web pages, FAQs), publish it on the Droog platform, and this plugin handles placing it on your site automatically.

**How it works:**

1. Sign up at [app.droog.io](https://app.droog.io) — free to get started.
2. Create your assistant and give it a name and personality.
3. Upload your content — PDFs, Word documents, web pages, or sitemaps.
4. Publish your assistant and copy your **Tenant ID** and **Agent ID** from the settings tab.
5. Paste both IDs into this plugin's settings page — your assistant goes live instantly.

For a full walkthrough, see the [Droog Quickstart Guide](https://documentation.droog.io/quickstart#registration).

**Features:**

* Quick setup — just paste your Tenant ID and Agent ID and you're done.
* Set a custom display name for your assistant.
* Choose where the chat button appears: **Bottom Right**, **Bottom Left**, or as an **inline search bar** on any page.
* Add sample questions to the search bar to guide visitors.
* Customise colors to match your brand.
* Turn the widget on or off with a single checkbox — no need to touch any settings.
* Place an inline search bar anywhere using the `[droog_search_bar]` shortcode.
* Loads asynchronously — no impact on your page speed.

== Installation ==

1. Upload the `droog-agent` folder to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress Admin.
3. Go to **Droog Agent** in the left-hand admin menu.
4. Enter your **Tenant ID** and **Agent ID** (see FAQ below for where to find these).
5. Click **Save Settings** — your assistant is now live on your site.

== Frequently Asked Questions ==

= Where do I find my Tenant ID and Agent ID? =

Log in to [app.droog.io](https://app.droog.io), open your published assistant, and go to the **Deploy** tab. You will see your Tenant ID and Agent ID listed there — copy each one and paste them into the corresponding fields on the plugin settings page.

= Do I need a Droog account? =

Yes. You can create a account at [app.droog.io](https://app.droog.io). New accounts start on a free Trial plan with no credit card required. See the [Droog Quickstart Guide](https://documentation.droog.io/quickstart#registration) for step-by-step instructions.

= What content can I upload to train my assistant? =

Droog supports PDF, Word (DOCX), plain text, Markdown, HTML, web page URLs, and sitemaps. After uploading, wait for all documents to show a green "completed" status before publishing your assistant.

= What is the inline search bar mode? =

Instead of a floating chat button, your assistant appears as a search bar embedded directly on the page. You can place it anywhere using the `[droog_search_bar]` shortcode, and add example questions that cycle through with a typewriter animation. Great for landing pages or help centres.

= Will this slow down my website? =

No. The widget loads in the background after your page content has already appeared, so your page speed scores are not affected.

= Can I show the widget on only some pages? =

Not in v1.0 — the widget is either shown on all pages or hidden entirely. Per-page control is planned for a future release.

= How do I temporarily hide the widget without losing my settings? =

Uncheck **Enable on All Pages** on the settings page and save. The assistant will disappear from your site until you turn it back on.

== External Services ==

This plugin connects to the Droog platform to power the AI chat assistant on your website.

**What the service is:** Droog is a third-party AI assistant service that lets you create and deploy intelligent chat assistants trained on your own content.

**What data is sent:** When visitors interact with the chat widget, their messages and session information are sent to Droog's servers to generate responses. No script files are loaded from external servers — the widget code is bundled directly within this plugin.

**When data is sent:** Data is transmitted when:
– The chat widget loads on your pages
– A visitor sends a message through the chat interface
– The AI generates a response

**Account required:** Yes — a free Droog account is needed at [app.droog.io](https://app.droog.io).

**Service links:**
– Terms of Service & Privacy Policy: https://www.droog.io/legal

== Screenshots ==

1. The Droog Agent settings page — enter your Tenant ID, Agent ID, display name, and appearance options.
2. The floating assistant launcher in the bottom-right corner of a live site.
3. The assistant chat panel open, showing a conversation with answers drawn from your content.
4. Inline search bar mode — embedded in a page using the `[droog_search_bar]` shortcode, with animated example questions.

== Changelog ==

= 1.0.0 =
* Initial release.
* Settings page with Tenant ID, Agent ID, assistant name, launcher position, and enable/disable toggle.
* Full color customisation: accent color, header background, header text, and input area background.
* Three launcher positions: bottom-right, bottom-left, and inline search bar.
* `[droog_search_bar]` shortcode for placing the search bar anywhere on a page.


== Upgrade Notice ==

= 1.0.0 =
Initial release — no upgrade steps required.
