<?php
if ( ! defined( 'ABSPATH' ) ) exit;
if ( ! current_user_can( 'manage_options' ) ) exit;
?>
<div class="wrap" id="droog-chatbot-settings">

	<h1><?php esc_html_e( 'Droog Chatbot', 'droog-agent' ); ?></h1>

	<div class="droog-notice-info notice notice-info inline">
		<p>
			<?php
			printf(
				/* translators: %s: link to Droog dashboard */
				esc_html__( 'Need your Bot Widget ID? %s to find it under Bot Settings.', 'droog-agent' ),
				'<a href="' . esc_url( 'https://app.droog.io' ) . '" target="_blank" rel="noopener noreferrer">'
					. esc_html__( 'Visit your Droog dashboard', 'droog-agent' )
				. '</a>'
			);
			?>
		</p>
	</div>

	<?php settings_errors( Droog_Admin::OPTION_KEY ); ?>

	<form method="post" action="options.php">
		<?php
		settings_fields( Droog_Admin::OPTION_GROUP );
		do_settings_sections( Droog_Admin::MENU_SLUG );
		wp_nonce_field( Droog_Admin::NONCE_ACTION, Droog_Admin::NONCE_FIELD );
		submit_button( __( 'Save Settings', 'droog-agent' ) );
		?>
	</form>

</div>
