<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Droog_Widget {

	/** Holds data-* attrs for script_loader_tag filter. */
	private $widget_data = array();

	public function init() {
		add_action( 'wp_enqueue_scripts',  array( $this, 'enqueue_widget_script' ) );
		add_filter( 'script_loader_tag',   array( $this, 'add_widget_data_attrs' ), 10, 3 );
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

	public function enqueue_widget_script() {
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

		// Store attrs so script_loader_tag filter can inject them.
		$this->widget_data = array(
			'data-bot-id'         => $settings['bot_widget_id'],
			'data-tenant-id'      => $settings['tenant_id'],
			'data-bot-name'       => $settings['bot_name'],
			'data-primary-color'  => $settings['primary_color'],
			'data-header-bg'      => $header_bg,
			'data-header-text'    => $settings['header_text_color'],
			'data-footer-bg'      => $settings['footer_bg_color'],
			'data-position'       => $settings['launcher_position'],
			'data-prompts'        => $prompts_json,
			'data-hide-powered-by' => $settings['show_powered_by'] ? 'false' : 'true',
		);

		wp_enqueue_script(
			'droog-widget',
			DROOG_CHATBOT_PLUGIN_URL . 'assets/js/droog-widget.js',
			array(),
			DROOG_CHATBOT_VERSION,
			true  // load in footer
		);
	}

	/**
	 * Injects data-* attributes onto the droog-widget script tag.
	 * wp_enqueue_script does not natively support arbitrary HTML attributes,
	 * so this filter appends them after the src attribute.
	 */
	public function add_widget_data_attrs( $tag, $handle, $src ) {
		if ( 'droog-widget' !== $handle || empty( $this->widget_data ) ) {
			return $tag;
		}

		$extra = '';
		foreach ( $this->widget_data as $attr => $value ) {
			$extra .= ' ' . $attr . '="' . esc_attr( $value ) . '"';
		}

		// Insert attrs before the closing > of the opening <script tag.
		return str_replace( ' src=', $extra . ' src=', $tag );
	}
}
