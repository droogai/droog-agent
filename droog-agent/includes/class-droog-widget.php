<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Droog_Widget {

	public function init() {
		add_action( 'wp_footer', array( $this, 'inject_widget_script' ), 99 );
		add_shortcode( 'droog_search_bar', array( $this, 'render_search_bar_shortcode' ) );
	}

	/**
	 * [droog_search_bar] — place this shortcode anywhere in page/post content.
	 * Outputs a static anchor div; the widget JS mounts the inline search bar inside it.
	 * Only renders when Launcher Position is set to "Google-centered" and credentials are saved.
	 */
	public function render_search_bar_shortcode( $atts ) {
		$settings = Droog_Admin::get_settings();

		if ( empty( $settings['bot_widget_id'] )
			|| empty( $settings['tenant_id'] )
			|| 'google-centered' !== $settings['launcher_position'] ) {
			return '';
		}

		return '<div id="droog-search-bar-anchor" class="droog-search-bar-wrap"></div>';
	}

	public function inject_widget_script() {
		$settings = Droog_Admin::get_settings();

		if ( empty( $settings['bot_widget_id'] ) || empty( $settings['tenant_id'] ) ) {
			return;
		}

		if ( ! $settings['enable_on_all_pages'] ) {
			return;
		}

		// header_bg_color falls back to primary_color when not set or identical.
		$header_bg = ! empty( $settings['header_bg_color'] )
			? $settings['header_bg_color']
			: $settings['primary_color'];

		// Prompts array serialized to JSON for the typewriter animation.
		$prompts_json = wp_json_encode( array_values( $settings['prompts'] ) );

		// Output is constructed server-side from stored scalar values — no raw
		// script content is ever stored or echoed.
		?>
<script
  src="https://droog-widget-assets.s3.ap-south-1.amazonaws.com/droog-widget.js"
  data-bot-id="<?php echo esc_attr( $settings['bot_widget_id'] ); ?>"
  data-tenant-id="<?php echo esc_attr( $settings['tenant_id'] ); ?>"
  data-bot-name="<?php echo esc_attr( $settings['bot_name'] ); ?>"
  data-primary-color="<?php echo esc_attr( $settings['primary_color'] ); ?>"
  data-header-bg="<?php echo esc_attr( $header_bg ); ?>"
  data-header-text="<?php echo esc_attr( $settings['header_text_color'] ); ?>"
  data-footer-bg="<?php echo esc_attr( $settings['footer_bg_color'] ); ?>"
  data-position="<?php echo esc_attr( $settings['launcher_position'] ); ?>"
  data-prompts="<?php echo esc_attr( $prompts_json ); ?>"
  async
></script>
		<?php
	}
}
