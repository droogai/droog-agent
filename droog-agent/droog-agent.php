<?php
/**
 * Plugin Name: Droog Agent
 * Plugin URI:  https://www.droog.io/wp-plugin
 * Description: Add your Droog AI agent to your WordPress site in seconds. No coding required.
 * Version:     1.0.0
 * Author:      Droog
 * Author URI:  https://droog.io
 * Text Domain: droog-agent
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'DROOG_CHATBOT_VERSION',    '1.0.0' );
define( 'DROOG_CHATBOT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'DROOG_CHATBOT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once DROOG_CHATBOT_PLUGIN_DIR . 'includes/class-droog-admin.php';
require_once DROOG_CHATBOT_PLUGIN_DIR . 'includes/class-droog-widget.php';

register_uninstall_hook( __FILE__, 'droog_chatbot_uninstall' );

/**
 * Uninstall callback — delegates to uninstall.php logic when called via hook.
 * The real cleanup lives in uninstall.php for direct uninstall path as well.
 */
function droog_chatbot_uninstall() {
	delete_option( 'droog_chatbot_settings' );
}

( new Droog_Admin() )->init();
( new Droog_Widget() )->init();
