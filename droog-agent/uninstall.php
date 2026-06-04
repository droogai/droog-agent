<?php
// Runs when the plugin is deleted from WP Admin > Plugins > Delete.
// Removes all plugin data from the database.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) exit;

delete_option( 'droog_chatbot_settings' );
