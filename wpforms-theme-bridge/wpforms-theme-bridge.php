<?php
/**
 * Plugin Name: WPForms Theme Styling Bridge
 * Description: Makes WPForms inherit your active theme's form styling without changing field markup.
 * Version: 1.0.0
 * Author: OrderlyChaos Dev
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPForms_Theme_Styling_Bridge {
    const VERSION = '1.0.0';

    public function __construct() {
        add_action('plugins_loaded', [$this, 'maybe_boot']);
    }

    public function maybe_boot(): void {
        if (!class_exists('WPForms') && !function_exists('wpforms')) {
            return;
        }

        add_action('wp_enqueue_scripts', [$this, 'enqueue_styles']);
        add_filter('body_class', [$this, 'add_body_class']);
    }

    public function enqueue_styles(): void {
        $handle = 'wpforms-theme-styling-bridge';
        $css    = plugins_url('assets/css/wpforms-theme-bridge.css', __FILE__);

        wp_enqueue_style($handle, $css, [], self::VERSION);
    }

    public function add_body_class(array $classes): array {
        $classes[] = 'wpforms-theme-bridge-active';

        return $classes;
    }
}

new WPForms_Theme_Styling_Bridge();
