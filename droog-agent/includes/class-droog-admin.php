<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Droog_Admin {

	const OPTION_KEY   = 'droog_chatbot_settings';
	const OPTION_GROUP = 'droog_chatbot_options';
	const MENU_SLUG    = 'droog-agent';
	const NONCE_ACTION = 'droog_chatbot_save_settings';
	const NONCE_FIELD  = '_droog_nonce';

	public function init() {
		add_action( 'admin_menu',            array( $this, 'register_menu' ) );
		add_action( 'admin_init',            array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
	}

	public function register_menu() {
		add_menu_page(
			__( 'Droog Agent', 'droog-agent' ),
			__( 'Droog Agent', 'droog-agent' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_settings_page' ),
			'dashicons-format-chat',
			81
		);
	}

	public function register_settings() {
		register_setting(
			self::OPTION_GROUP,
			self::OPTION_KEY,
			array( 'sanitize_callback' => array( $this, 'sanitize_settings' ) )
		);

		// ── Widget Configuration section ──────────────────────────────────────
		add_settings_section( 'droog_chatbot_main', __( 'Widget Configuration', 'droog-agent' ), '__return_false', self::MENU_SLUG );

		add_settings_field( 'tenant_id',         __( 'Tenant ID', 'droog-agent' ),           array( $this, 'field_tenant_id' ),         self::MENU_SLUG, 'droog_chatbot_main' );
		add_settings_field( 'bot_widget_id',     __( 'Agent Widget ID', 'droog-agent' ),     array( $this, 'field_bot_widget_id' ),     self::MENU_SLUG, 'droog_chatbot_main' );
		add_settings_field( 'bot_name',          __( 'Assistant Name', 'droog-agent' ),      array( $this, 'field_bot_name' ),          self::MENU_SLUG, 'droog_chatbot_main' );
		add_settings_field( 'launcher_position', __( 'Launcher Position', 'droog-agent' ),   array( $this, 'field_launcher_position' ), self::MENU_SLUG, 'droog_chatbot_main' );
		add_settings_field( 'prompts',           __( 'Animated Prompts', 'droog-agent' ),    array( $this, 'field_prompts' ),           self::MENU_SLUG, 'droog_chatbot_main' );
		add_settings_field( 'enable_on_all_pages', __( 'Enable on All Pages', 'droog-agent' ), array( $this, 'field_enable_on_all_pages' ), self::MENU_SLUG, 'droog_chatbot_main' );

		// ── Appearance section ────────────────────────────────────────────────
		add_settings_section( 'droog_chatbot_appearance', __( 'Appearance', 'droog-agent' ), '__return_false', self::MENU_SLUG );

		add_settings_field( 'primary_color',      __( 'Accent Color', 'droog-agent' ),          array( $this, 'field_primary_color' ),      self::MENU_SLUG, 'droog_chatbot_appearance' );
		add_settings_field( 'header_bg_color',    __( 'Header Background', 'droog-agent' ),     array( $this, 'field_header_bg_color' ),    self::MENU_SLUG, 'droog_chatbot_appearance' );
		add_settings_field( 'header_text_color',  __( 'Header Text Color', 'droog-agent' ),     array( $this, 'field_header_text_color' ),  self::MENU_SLUG, 'droog_chatbot_appearance' );
		add_settings_field( 'footer_bg_color',    __( 'Footer Background', 'droog-agent' ),     array( $this, 'field_footer_bg_color' ),    self::MENU_SLUG, 'droog_chatbot_appearance' );
	}

	// ---------------------------------------------------------------------------
	// Sanitization
	// ---------------------------------------------------------------------------

	public function sanitize_settings( $raw ) {
		$clean    = array();
		$defaults = self::get_defaults();
		$errors   = array();

		// tenant_id
		$tenant_id = isset( $raw['tenant_id'] ) ? trim( $raw['tenant_id'] ) : '';
		if ( '' === $tenant_id ) {
			$clean['tenant_id'] = '';
		} elseif ( preg_match( '/^[a-zA-Z0-9_-]+$/', $tenant_id ) ) {
			$clean['tenant_id'] = $tenant_id;
		} else {
			$errors[]           = __( 'Tenant ID contains invalid characters. Use only letters, numbers, hyphens, and underscores.', 'droog-agent' );
			$clean['tenant_id'] = $defaults['tenant_id'];
		}

		// bot_widget_id
		$widget_id = isset( $raw['bot_widget_id'] ) ? trim( $raw['bot_widget_id'] ) : '';
		if ( '' === $widget_id ) {
			$clean['bot_widget_id'] = '';
		} elseif ( preg_match( '/^[a-zA-Z0-9_-]+$/', $widget_id ) ) {
			$clean['bot_widget_id'] = $widget_id;
		} else {
			$errors[]               = __( 'Agent Widget ID contains invalid characters. Use only letters, numbers, hyphens, and underscores.', 'droog-agent' );
			$clean['bot_widget_id'] = $defaults['bot_widget_id'];
		}

		// bot_name — plain text, max 60 chars
		$bot_name          = isset( $raw['bot_name'] ) ? sanitize_text_field( $raw['bot_name'] ) : $defaults['bot_name'];
		$clean['bot_name'] = mb_substr( $bot_name, 0, 60 );
		if ( '' === $clean['bot_name'] ) {
			$clean['bot_name'] = $defaults['bot_name'];
		}

		// launcher_position
		$allowed_positions          = array( 'bottom-right', 'bottom-left', 'google-centered' );
		$position                   = isset( $raw['launcher_position'] ) ? $raw['launcher_position'] : $defaults['launcher_position'];
		$clean['launcher_position'] = in_array( $position, $allowed_positions, true ) ? $position : $defaults['launcher_position'];

		// prompts — textarea, one per line, sanitized individually
		$raw_prompts   = isset( $raw['prompts'] ) ? $raw['prompts'] : '';
		$lines         = explode( "\n", $raw_prompts );
		$clean_prompts = array();
		foreach ( $lines as $line ) {
			$line = sanitize_text_field( trim( $line ) );
			if ( '' !== $line ) {
				$clean_prompts[] = $line;
			}
		}
		$clean['prompts'] = $clean_prompts;

		// enable_on_all_pages
		$clean['enable_on_all_pages'] = ! empty( $raw['enable_on_all_pages'] );

		// Color fields — shared hex validator
		foreach ( array( 'primary_color', 'header_bg_color', 'header_text_color', 'footer_bg_color' ) as $field ) {
			$val = isset( $raw[ $field ] ) ? trim( $raw[ $field ] ) : $defaults[ $field ];
			if ( preg_match( '/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/', $val ) ) {
				$clean[ $field ] = $val;
			} else {
				$errors[]        = sprintf(
					/* translators: %s: field label */
					__( 'Invalid hex color for %s. Reverting to default.', 'droog-agent' ),
					$field
				);
				$clean[ $field ] = $defaults[ $field ];
			}
		}

		foreach ( $errors as $message ) {
			add_settings_error( self::OPTION_KEY, 'droog_validation_error', $message, 'error' );
		}

		return $clean;
	}

	// ---------------------------------------------------------------------------
	// Field renderers
	// ---------------------------------------------------------------------------

	public function field_tenant_id() {
		$s = self::get_settings();
		?>
		<input type="text" id="droog_tenant_id"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[tenant_id]"
			value="<?php echo esc_attr( $s['tenant_id'] ); ?>"
			class="regular-text" placeholder="e.g. acme-corp" />
		<p class="description"><?php esc_html_e( 'Your Droog tenant ID, found in your dashboard under Account Settings.', 'droog-agent' ); ?></p>
		<?php
	}

	public function field_bot_widget_id() {
		$s = self::get_settings();
		?>
		<input type="text" id="droog_bot_widget_id"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[bot_widget_id]"
			value="<?php echo esc_attr( $s['bot_widget_id'] ); ?>"
			class="regular-text" placeholder="e.g. bot-id-fac108d412c4" />
		<p class="description"><?php esc_html_e( 'The Agent Widget ID found in your Droog dashboard under Agent Settings.', 'droog-agent' ); ?></p>
		<?php
	}

	public function field_bot_name() {
		$s = self::get_settings();
		?>
		<input type="text" id="droog_bot_name"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[bot_name]"
			value="<?php echo esc_attr( $s['bot_name'] ); ?>"
			class="regular-text" maxlength="60" placeholder="Droog Agent" />
		<p class="description"><?php esc_html_e( 'The name shown in the chat header. Max 60 characters.', 'droog-agent' ); ?></p>
		<?php
	}

	public function field_launcher_position() {
		$s       = self::get_settings();
		$options = array(
			'bottom-right'    => __( 'Bottom Right (floating button)', 'droog-agent' ),
			'bottom-left'     => __( 'Bottom Left (floating button)', 'droog-agent' ),
			'google-centered' => __( 'Google-centered (search bar in middle of page)', 'droog-agent' ),
		);
		?>
		<select id="droog_launcher_position" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[launcher_position]">
			<?php foreach ( $options as $value => $label ) : ?>
				<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $s['launcher_position'], $value ); ?>>
					<?php echo esc_html( $label ); ?>
				</option>
			<?php endforeach; ?>
		</select>
		<?php
	}

	public function field_prompts() {
		$s     = self::get_settings();
		$value = implode( "\n", $s['prompts'] );
		?>
		<textarea id="droog_prompts"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[prompts]"
			rows="4" class="large-text"
			placeholder="<?php esc_attr_e( "How fast can I get started?\nWhat does your AI do?\nCan I try for free?", 'droog-agent' ); ?>"
		><?php echo esc_textarea( $value ); ?></textarea>
		<p class="description"><?php esc_html_e( 'One prompt per line. Displayed as a typewriter animation in Google-centered mode.', 'droog-agent' ); ?></p>
		<?php
	}

	public function field_enable_on_all_pages() {
		$s = self::get_settings();
		?>
		<label for="droog_enable_on_all_pages">
			<input type="checkbox" id="droog_enable_on_all_pages"
				name="<?php echo esc_attr( self::OPTION_KEY ); ?>[enable_on_all_pages]"
				value="1" <?php checked( $s['enable_on_all_pages'] ); ?> />
			<?php esc_html_e( 'Inject the widget on every page of the site.', 'droog-agent' ); ?>
		</label>
		<?php
	}

	public function field_primary_color() {
		$s = self::get_settings();
		?>
		<input type="color" id="droog_primary_color"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[primary_color]"
			value="<?php echo esc_attr( $s['primary_color'] ); ?>" />
		<span class="description"><?php esc_html_e( 'Buttons, message bubbles, launcher, search bar border. Default: #6366f1.', 'droog-agent' ); ?></span>
		<?php
	}

	public function field_header_bg_color() {
		$s = self::get_settings();
		?>
		<input type="color" id="droog_header_bg_color"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[header_bg_color]"
			value="<?php echo esc_attr( $s['header_bg_color'] ); ?>" />
		<span class="description"><?php esc_html_e( 'Chat panel header background. Defaults to accent color if not set.', 'droog-agent' ); ?></span>
		<?php
	}

	public function field_header_text_color() {
		$s = self::get_settings();
		?>
		<input type="color" id="droog_header_text_color"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[header_text_color]"
			value="<?php echo esc_attr( $s['header_text_color'] ); ?>" />
		<span class="description"><?php esc_html_e( 'Chat panel header text and icon color. Default: #ffffff.', 'droog-agent' ); ?></span>
		<?php
	}

	public function field_footer_bg_color() {
		$s = self::get_settings();
		?>
		<input type="color" id="droog_footer_bg_color"
			name="<?php echo esc_attr( self::OPTION_KEY ); ?>[footer_bg_color]"
			value="<?php echo esc_attr( $s['footer_bg_color'] ); ?>" />
		<span class="description"><?php esc_html_e( 'Chat panel input area and "Powered by" footer background. Default: #f9fafb.', 'droog-agent' ); ?></span>
		<?php
	}

	// ---------------------------------------------------------------------------
	// Page render & assets
	// ---------------------------------------------------------------------------

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'droog-agent' ) );
		}
		require_once DROOG_CHATBOT_PLUGIN_DIR . 'admin/views/settings-page.php';
	}

	public function enqueue_admin_assets( $hook ) {
		if ( 'toplevel_page_' . self::MENU_SLUG !== $hook ) {
			return;
		}
		wp_enqueue_style(
			'droog-agent-admin',
			DROOG_CHATBOT_PLUGIN_URL . 'assets/css/admin.css',
			array(),
			DROOG_CHATBOT_VERSION
		);
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	public static function get_defaults() {
		return array(
			'tenant_id'           => '',
			'bot_widget_id'       => '',
			'bot_name'            => 'Droog Agent',
			'launcher_position'   => 'bottom-right',
			'prompts'             => array(),
			'enable_on_all_pages' => true,
			'primary_color'       => '#6366f1',
			'header_bg_color'     => '#6366f1',
			'header_text_color'   => '#ffffff',
			'footer_bg_color'     => '#f9fafb',
		);
	}

	public static function get_settings() {
		$saved = get_option( self::OPTION_KEY, array() );
		return wp_parse_args( $saved, self::get_defaults() );
	}
}
